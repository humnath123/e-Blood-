require("dotenv/config");

const { closePool, runQuery } = require("../dist/database/pool");

function isFlagSet(user, field) {
  return Number(user[field]) === 1;
}

function determineDonorEligibility(user, now = new Date()) {
  const issues = [];
  const isAvailable = Number(user.is_available) === 1;
  let status = isAvailable ? "Eligible" : "Not Available";

  if (!isAvailable) {
    issues.push("Donor is marked as unavailable");
  }

  if (isAvailable && user.last_donation_date) {
    const lastDonation = new Date(user.last_donation_date);
    if (Number.isNaN(lastDonation.getTime()) || lastDonation > now) {
      status = "Pending - Donation History Review";
      issues.push("The last donation date is invalid or in the future");
    } else {
      const daysSinceDonation = (now - lastDonation) / (1000 * 60 * 60 * 24);
      if (daysSinceDonation < 56) {
        status = "Pending - Waiting Period";
        issues.push(
          `Wait ${Math.ceil(56 - daysSinceDonation)} more days since the last donation`
        );
      }
    }
  }

  const screeningDate = user.last_screening_date
    ? new Date(user.last_screening_date)
    : null;
  const hasCompletedScreening = Boolean(
    screeningDate &&
    !Number.isNaN(screeningDate.getTime()) &&
    screeningDate <= now
  );
  if (isAvailable && !hasCompletedScreening) {
    if (status === "Eligible") status = "Pending - Screening Required";
    issues.push("No valid health screening is recorded");
  }

  const pendingReasons = [
    ["has_fever", "Fever/Active Infection"],
    ["has_anaemia", "Anaemia"],
    ["has_jaundice", "Jaundice"],
    ["is_pregnant", "Pregnancy"],
    ["has_heart_disease", "Medical Review"],
    ["has_diabetes", "Diabetes Assessment"],
    ["has_high_blood_pressure", "Medical Review"],
    ["has_low_blood_pressure", "Medical Review"],
    ["has_tuberculosis", "Medical Review"],
    ["has_malaria", "Medical Review"],
  ];
  for (const [field, reason] of pendingReasons) {
    if (isFlagSet(user, field)) {
      if (isAvailable && status === "Eligible") status = `Pending - ${reason}`;
      issues.push(`${field.replaceAll("_", " ")} requires clinical review`);
    }
  }

  const deferrals = [
    ["has_hiv", "HIV"],
    ["has_hepatitis_b", "Hepatitis B"],
    ["has_hepatitis_c", "Hepatitis C"],
    ["has_syphilis", "Syphilis"],
  ];
  const deferral = deferrals.find(([field]) => isFlagSet(user, field));
  if (deferral) {
    const [, label] = deferral;
    issues.push(`${label} requires blood-bank medical review before donation`);
    if (isAvailable) status = `Not Eligible - ${label}`;
  }

  const result = {
    userId: user.user_id,
    username: user.username,
    bloodGroup: user.blood_group,
    eligibilityStatus: status,
    lastDonation: user.last_donation_date
      ? new Date(user.last_donation_date).toLocaleDateString()
      : "Never",
    totalDonations: Number(user.total_donations ?? 0),
    lastScreening: hasCompletedScreening
      ? screeningDate.toLocaleDateString()
      : "Never screened",
    issues,
    canDonate: status === "Eligible" ? "Yes" : "No - See issues below",
  };

  if (issues.length > 0) {
    result.recommendation = getRecommendation(status, issues);
  }

  return result;
}

function getRecommendation(status, issues) {
  if (status === "Eligible") {
    return "Complete the blood bank's final in-person screening before donation.";
  }
  if (status === "Not Available") {
    return "Update availability only after a blood-bank professional confirms eligibility.";
  }
  if (status === "Pending - Waiting Period") {
    const days = issues[0].match(/Wait (\d+)/)?.[1];
    return days
      ? `Reassess after the required donation interval (${days} day(s) remaining).`
      : "Have blood-bank staff review the donation interval.";
  }
  if (status.startsWith("Not Eligible -")) {
    return "Do not donate until a qualified blood-bank professional has reviewed and cleared the case.";
  }
  return "A qualified blood-bank professional must complete or review screening before donation.";
}

async function checkDonorEligibility(userId, now = new Date()) {
  const donors = await runQuery(
    `SELECT
       u.user_id AS "user_id",
       u.username AS "username",
       u.blood_group AS "blood_group",
       u.is_available AS "is_available",
       u.last_screening_date AS "last_screening_date",
       u.has_hiv AS "has_hiv",
       u.has_hepatitis_b AS "has_hepatitis_b",
       u.has_hepatitis_c AS "has_hepatitis_c",
       u.has_syphilis AS "has_syphilis",
       u.has_malaria AS "has_malaria",
       u.has_anaemia AS "has_anaemia",
       u.has_fever AS "has_fever",
       u.has_jaundice AS "has_jaundice",
       u.is_pregnant AS "is_pregnant",
       u.has_heart_disease AS "has_heart_disease",
       u.has_diabetes AS "has_diabetes",
       u.has_high_blood_pressure AS "has_high_blood_pressure",
       u.has_low_blood_pressure AS "has_low_blood_pressure",
       u.has_tuberculosis AS "has_tuberculosis",
       (SELECT MAX(d.collected_at)
        FROM donations d
        WHERE d.user_id = u.user_id) AS "last_donation_date",
       (SELECT COUNT(*)
        FROM donations d
        WHERE d.user_id = u.user_id) AS "total_donations"
     FROM users u
     WHERE u.user_id = :1 AND LOWER(u.role) = 'donor'`,
    [userId]
  );

  if (donors.length === 0) {
    return { error: "Donor not found" };
  }

  return determineDonorEligibility(donors[0], now);
}

async function generateEligibilityReport(options = {}) {
  const role = options.role || "donor";
  const filters = ["LOWER(u.role) = LOWER(:role)"];
  const binds = { role };

  if (options.status) {
    filters.push("u.eligibility_status = :status");
    binds.status = options.status;
  }
  if (options.bloodGroup) {
    filters.push("u.blood_group = :bloodGroup");
    binds.bloodGroup = options.bloodGroup;
  }

  const donors = await runQuery(
    `SELECT
       u.user_id AS "user_id",
       u.eligibility_status AS "eligibility_status",
       u.has_fever AS "has_fever",
       u.has_anaemia AS "has_anaemia",
       u.has_jaundice AS "has_jaundice",
       u.is_pregnant AS "is_pregnant",
       u.has_heart_disease AS "has_heart_disease",
       u.has_diabetes AS "has_diabetes",
       (SELECT MAX(d.collected_at)
        FROM donations d
        WHERE d.user_id = u.user_id) AS "last_donation_date"
     FROM users u
     WHERE ${filters.join(" AND ")}
     ORDER BY u.eligibility_status, u.user_id`,
    binds
  );

  const summary = {
    total: donors.length,
    eligible: 0,
    pending: 0,
    not_eligible: 0,
    not_available: 0,
    byStatus: {},
    commonIssues: {
      fever: 0,
      anaemia: 0,
      jaundice: 0,
      pregnancy: 0,
      heart_disease: 0,
      diabetes: 0,
    },
  };

  for (const donor of donors) {
    const status = donor.eligibility_status || "pending";
    summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
    if (status === "eligible") summary.eligible += 1;
    else if (status === "pending") summary.pending += 1;
    else if (status === "not_eligible") summary.not_eligible += 1;
    else if (status === "not_available") summary.not_available += 1;

    if (isFlagSet(donor, "has_fever")) summary.commonIssues.fever += 1;
    if (isFlagSet(donor, "has_anaemia")) summary.commonIssues.anaemia += 1;
    if (isFlagSet(donor, "has_jaundice")) summary.commonIssues.jaundice += 1;
    if (isFlagSet(donor, "is_pregnant")) summary.commonIssues.pregnancy += 1;
    if (isFlagSet(donor, "has_heart_disease")) summary.commonIssues.heart_disease += 1;
    if (isFlagSet(donor, "has_diabetes")) summary.commonIssues.diabetes += 1;
  }

  return { donors, summary };
}

async function main() {
  const [command, argument] = process.argv.slice(2);
  try {
    switch (command) {
    case "check": {
      const userId = Number(argument);
      if (!Number.isSafeInteger(userId) || userId < 1) {
        throw new Error("Usage: node scripts/check-donor-eligibility.js check <userId>");
      }
      console.log(JSON.stringify(await checkDonorEligibility(userId), null, 2));
      break;
    }
    case "report": {
      const { summary } = await generateEligibilityReport();
      console.log("=== DONOR ELIGIBILITY REPORT ===\n");
      console.log(`Total donors: ${summary.total}`);
      console.log(`Eligible: ${summary.eligible}`);
      console.log(`Pending: ${summary.pending}`);
      console.log(`Not eligible: ${summary.not_eligible}`);
      console.log(`Not available: ${summary.not_available}\n`);
      console.log("Common screening flags:");
      console.log(`  Fever/Active Infection: ${summary.commonIssues.fever}`);
      console.log(`  Anaemia/Low Hb: ${summary.commonIssues.anaemia}`);
      console.log(`  Jaundice: ${summary.commonIssues.jaundice}`);
      console.log(`  Pregnancy: ${summary.commonIssues.pregnancy}`);
      console.log(`  Heart Disease: ${summary.commonIssues.heart_disease}`);
      console.log(`  Diabetes: ${summary.commonIssues.diabetes}`);
      console.log("\nEligibility breakdown:");
      for (const [status, count] of Object.entries(summary.byStatus)) {
        console.log(`  ${status}: ${count}`);
      }
      break;
    }
    case "check-all": {
      const donors = await runQuery(
        `SELECT user_id AS "user_id", username AS "username", blood_group AS "blood_group"
         FROM users WHERE LOWER(role) = 'donor' ORDER BY user_id`
      );
      const counts = { eligible: 0, pending: 0, notEligible: 0, notAvailable: 0 };
      for (const donor of donors) {
        const result = await checkDonorEligibility(donor.user_id);
        console.log(`${donor.username} (${donor.blood_group}): ${result.eligibilityStatus || result.error}`);
        for (const issue of result.issues || []) console.log(`  - ${issue}`);

        const status = result.eligibilityStatus || "";
        if (status === "Eligible") counts.eligible += 1;
        else if (status === "Not Available") counts.notAvailable += 1;
        else if (status.startsWith("Not Eligible")) counts.notEligible += 1;
        else counts.pending += 1;
      }
      console.log("\nSummary:", JSON.stringify(counts, null, 2));
      break;
    }
    case "view-eligible": {
      const donors = await runQuery(
        `SELECT "username", "blood_group", "donation_status", "last_donation_date", "deferral_reason_text"
         FROM vw_eligible_donors
         WHERE eligibility_status = 'eligible'
         ORDER BY user_id`
      );
      console.log(`=== ELIGIBLE DONORS (${donors.length}) ===\n`);
      for (const donor of donors) {
        console.log(`${donor.username} (${donor.blood_group}) - ${donor.donation_status}`);
        console.log(`  Last donation: ${donor.last_donation_date ?? "Never"}`);
        if (donor.deferral_reason_text) console.log(`  Review note: ${donor.deferral_reason_text}`);
        console.log();
      }
      break;
    }
      default:
        console.log("Available commands:");
        console.log("  check <userId> - Check a donor without changing stored screening data");
        console.log("  report - Print aggregate eligibility counts");
        console.log("  check-all - Check each donor");
        console.log("  view-eligible - View donors with stored eligible status");
        console.log("\nExample: node scripts/check-donor-eligibility.js report");
    }
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Eligibility check failed:", error instanceof Error ? error.message : "UNKNOWN");
    process.exitCode = 1;
  });
}

module.exports = {
  determineDonorEligibility,
  generateEligibilityReport,
  checkDonorEligibility,
};
