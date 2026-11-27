require("dotenv/config");

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { buildDonationCertificate } = require("../dist/services/donation-certificate");
const {
  buildDonationCertificateEmail,
  certificateLogoCid,
} = require("../dist/services/donation-certificate-email");

const outputDirectory = path.resolve(__dirname, "..", "test-output");
const outputPath = path.join(outputDirectory, "certificate.pdf");
const signatures = [
  { name: "Humnath Pokharel", file: "humanth.png" },
  { name: "Surav Bogati", file: "surav.png" },
  { name: "Prashant Syangtan", file: "prashant.png" },
];
const sample = {
  donorName: "Prashant Tamang",
  bloodGroup: "O+",
  donationDate: "2026-03-15T10:00:00+05:45",
  certificateId: "EBLD-TEST-DON-PRASHANT",
};

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function extractPdf(buffer) {
  const source = buffer.toString("latin1");
  const mediaBoxMatch = source.match(/\/MediaBox\s+\[([^\]]+)\]/);
  assert.ok(mediaBoxMatch, "PDF must include a page size");
  const mediaBox = mediaBoxMatch[1].trim().split(/\s+/).map(Number);
  const streams = [];

  for (const match of source.matchAll(/stream\r?\n/g)) {
    const start = match.index + match[0].length;
    const end = source.indexOf("endstream", start);
    if (end < 0) continue;
    try {
      streams.push(zlib.inflateSync(buffer.subarray(start, end)).toString("latin1"));
    } catch {
      // Non-Flate streams, such as signature image data, are not page content.
    }
  }

  const content = streams.join("\n");
  const textItems = Array.from(
    content.matchAll(
      /1 0 0 1\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm\s*\/F\d+\s+([\d.]+)\s+Tf\s*(?:-?[\d.]+\s+(?:Tc|Tw)\s*)*\[([\s\S]*?)\]\s*TJ/g
    ),
    (match) => ({
      x: Number(match[1]),
      baseline: mediaBox[3] - Number(match[2]),
      fontSize: Number(match[3]),
      text: Array.from(match[4].matchAll(/<([0-9a-f]+)>/gi), (hex) =>
        Buffer.from(hex[1], "hex").toString("utf8")
      ).join(""),
    })
  );
  const signatureLines = Array.from(
    content.matchAll(
      /(-?[\d.]+)\s+(-?[\d.]+)\s+m\s+(-?[\d.]+)\s+(-?[\d.]+)\s+l\s+S/g
    ),
    (match) => ({
      x1: Number(match[1]),
      y1: Number(match[2]),
      x2: Number(match[3]),
      y2: Number(match[4]),
    })
  ).filter((line) =>
    Math.abs(line.y1 - line.y2) < 0.1 && line.y1 > 400
  );

  return {
    source,
    content,
    pages: Array.from(source.matchAll(/\/Type\s*\/Page\b/g)).length,
    width: mediaBox[2] - mediaBox[0],
    height: mediaBox[3] - mediaBox[1],
    textItems,
    signatureLines,
  };
}

function assertOneLandscapePage(pdf, label) {
  const inspected = extractPdf(pdf);
  assert.equal(inspected.pages, 1, `${label} must contain exactly one page`);
  assert.ok(inspected.width > inspected.height, `${label} must be landscape`);
  assert.ok(Math.abs(inspected.width - 841.89) < 1, `${label} must use A4 landscape width`);
  assert.ok(Math.abs(inspected.height - 595.28) < 1, `${label} must use A4 landscape height`);
  return inspected;
}

function assertSignatureLayout(inspected) {
  assert.equal(inspected.signatureLines.length, 3, "PDF must contain three signature lines");
  const lines = [...inspected.signatureLines].sort((a, b) => a.x1 - b.x1);
  const widths = lines.map((line) => line.x2 - line.x1);
  assert.ok(widths.every((width) => Math.abs(width - widths[0]) < 0.1), "Signature columns must be equal width");
  assert.ok(lines.every((line) => Math.abs(line.y1 - lines[0].y1) < 0.1 && Math.abs(line.y2 - line.y1) < 0.1), "Signature lines must share one row");

  for (let index = 0; index < signatures.length; index += 1) {
    const signature = signatures[index];
    const line = lines[index];
    const signerText = inspected.textItems.find((item) =>
      item.text === signature.name &&
      item.x > line.x1 &&
      item.x < line.x2 &&
      item.baseline > line.y1 &&
      item.baseline < line.y1 + 25
    );
    const titleText = inspected.textItems.find((item) =>
      item.text === "CEO, e-Blood" && item.x >= line.x1 && item.x <= line.x2 && item.baseline > line.y1 + 10
    );

    assert.ok(signerText, `Signature name ${signature.name} must be present`);
    assert.ok(titleText, `${signature.name} must be identified as a CEO`);
    assert.ok(titleText.baseline > signerText.baseline + signerText.fontSize, `${signature.name}'s name and title must not overlap`);
  }

  const nonSignerItems = inspected.textItems.filter((item) =>
    !signatures.some((signature) => signature.name === item.text) &&
    item.text !== "CEO, e-Blood" &&
    item.text !== "CONNECTING DONORS. SAVING LIVES."
  );
  const bodyBottom = Math.max(...nonSignerItems.map((item) => item.baseline + item.fontSize));
  assert.ok(bodyBottom < lines[0].y1 - 20, "Certificate details must not overlap the signature row");
}

function assertCertificateDetails(inspected, data) {
  const text = inspected.textItems.map((item) => item.text).join(" ");
  const donationDate = new Intl.DateTimeFormat("en-NP", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kathmandu",
  }).format(new Date(data.donationDate));
  for (const detail of [
    "CERTIFICATE OF APPRECIATION",
    data.donorName,
    "PRESENTED TO",
    "IN RECOGNITION OF YOUR GENEROUS BLOOD DONATION",
    "BLOOD GROUP",
    data.bloodGroup,
    "DONATION DATE",
    donationDate,
    "CERTIFICATE ID",
    data.certificateId,
    "Humnath Pokharel",
    "Surav Bogati",
    "Prashant Syangtan",
    "CEO, e-Blood",
    "Your generosity represents the true spirit of humanity.",
  ]) {
    assert.ok(text.includes(detail), `Certificate is missing: ${detail}`);
  }
  const projectRoot = path.resolve(__dirname, "..");
  const logoPath = path.join(projectRoot, "assets", "eblood-logo.png");
  const certificateLogoPath = path.join(projectRoot, "assets", "eblood-certificate-logo.png");
  assert.ok(fs.existsSync(logoPath), "The original e-Blood logo asset must exist");
  assert.ok(fs.existsSync(certificateLogoPath), "The certificate logo must be derived from the app logo");
  assert.ok(fs.statSync(logoPath).size > 100_000, "The original high-resolution logo asset must be used");
  assert.equal(fs.readFileSync(certificateLogoPath)[25], 6, "The certificate logo must retain transparency around the original artwork");
  assert.match(inspected.source, /\/Subtype\s*\/Image\b/, "Certificate must embed the eBlood logo image");
  assert.match(inspected.content, /1\s+0\.9764[0-9]*\s+0\.9098[0-9]*\s+scn/, "PDF must use a solid ivory certificate panel");
  assert.match(inspected.content, /0\.2941[0-9]*\s+0\.0627[0-9]*\s+0\.1254[0-9]*\s+scn/, "PDF must use readable burgundy text");
  assert.match(inspected.content, /0\.7686[0-9]*\s+0\.6313[0-9]*\s+0\.3529[0-9]*/, "PDF must use gold decorative borders");
  assert.match(inspected.content, /0\.1921[0-9]*\s+0\.0274[0-9]*\s+0\.0745[0-9]*\s+scn/, "PDF must use a dark layered panel shadow");
  assert.doesNotMatch(inspected.source, /\/ca\s+0\.[0-9]+/, "PDF must not use faded transparency");
}

async function main() {
  fs.mkdirSync(outputDirectory, { recursive: true });

  const certificateEmail = buildDonationCertificateEmail(
    '<script>Test Donor</script>',
    'EBLD-DON-TEST'
  );
  assert.match(certificateEmail.subject, /Donation Certificate/i);
  assert.match(certificateEmail.html, /cid:eblood-certificate-logo/);
  assert.match(certificateEmail.html, /&lt;script&gt;Test Donor&lt;\/script&gt;/);
  assert.doesNotMatch(certificateEmail.html, /<script>Test Donor/);
  assert.match(certificateEmail.html, /Certificate ID: EBLD-DON-TEST/);
  assert.equal(certificateLogoCid, "eblood-certificate-logo");
  console.log("PASS certificate email: responsive e-Blood layout, inline logo, escaped donor name, and certificate ID.");

  const samplePdf = await buildDonationCertificate(sample);
  fs.writeFileSync(outputPath, samplePdf);
  const sampleInspection = assertOneLandscapePage(samplePdf, "Sample certificate");
  assertCertificateDetails(sampleInspection, sample);
  assertSignatureLayout(sampleInspection);
  console.log("PASS sample PDF: one A4 landscape page, ivory/burgundy/gold design, embedded logo, and non-overlapping signatures.");
  console.log(`Saved ${path.relative(process.cwd(), outputPath)} using dummy test data.`);

  const longNameData = {
    ...sample,
    donorName: "Humnath Pokharel ".repeat(6).trim() + " (TEST DATA)",
    certificateId: "EBLD-TEST-DON-LONG",
  };
  const longNamePdf = await buildDonationCertificate(longNameData);
  const longNameInspection = assertOneLandscapePage(longNamePdf, "Long-name certificate");
  assert.ok(
    normalizeText(longNameInspection.textItems.map((item) => item.text).join(" "))
      .includes(normalizeText(longNameData.donorName))
  );
  assertSignatureLayout(longNameInspection);
  console.log("PASS long-name PDF: donor name and signature layout fit on one page.");

  const nepaliData = {
    ...sample,
    donorName: "परीक्षण दाता (TEST DATA)",
    certificateId: "EBLD-TEST-DON-NEPALI",
  };
  try {
    const nepaliPdf = await buildDonationCertificate(nepaliData);
    assertOneLandscapePage(nepaliPdf, "Nepali-name certificate");
    console.log("PASS Nepali-name PDF: Noto Sans Devanagari font was found and certificate generated.");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("Noto Sans Devanagari font is required")) {
      throw error;
    }
    console.log("BLOCKED Nepali-name PDF: add assets/fonts/NotoSansDevanagari-Regular.ttf to render Devanagari names.");
  }

  const missingSignature = signatures.find(({ file }) =>
    !fs.existsSync(path.resolve(__dirname, "..", "signatures", file))
  );
  if (missingSignature) {
    const missingImagePdf = await buildDonationCertificate({
      ...sample,
      certificateId: "EBLD-TEST-DON-MISSING-SIGNATURE",
    });
    const missingImageInspection = assertOneLandscapePage(missingImagePdf, "Missing-signature certificate");
    assertSignatureLayout(missingImageInspection);
    console.log(`PASS missing-signature fallback: line and name render when ${missingSignature.file} is absent.`);
  } else {
    console.log("BLOCKED missing-signature case: all signature images exist; none were changed or removed for testing.");
  }

  if (process.argv.includes("--send-email")) {
    const testEmail = process.env.TEST_EMAIL || "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      throw new Error("Set a valid TEST_EMAIL in .env before sending the certificate test.");
    }

    const { getMailer } = require("../dist/services/mailer");
    const mailer = getMailer();
    if (!mailer) throw new Error("SMTP_HOST is not configured.");
    try {
      await mailer.transporter.verify();
      await mailer.transporter.sendMail({
        from: mailer.from,
        to: testEmail,
        subject: "eBlood Donor Certificate Delivery Verification (TEST DATA)",
        text: [
          "Dear eBlood Team,",
          "",
          "This automated message verifies the eBlood donor certificate workflow, including PDF generation, attachment handling, and SMTP submission.",
          "",
          "The attached certificate was generated with test data for Prashant Tamang. It is for software testing only and is not an official donation record or proof of donation.",
          "",
          "No action is required. Please do not distribute or rely on the attachment as an official certificate.",
          "",
          "Sincerely,",
          "eBlood Backend Team",
          "Connecting Donors. Saving Lives.",
        ].join("\n"),
        attachments: [{
          filename: "eBlood-test-certificate.pdf",
          content: samplePdf,
          contentType: "application/pdf",
        }],
      });
      console.log("PASS SMTP submission to TEST_EMAIL. No other recipient is accepted by this script.");
    } finally {
      mailer.transporter.close();
    }
  } else {
    console.log("SKIPPED SMTP send because --send-email was not supplied.");
  }
}

main().catch((error) => {
  console.error("Certificate test failed:", error instanceof Error ? error.message : "UNKNOWN");
  process.exitCode = 1;
});
