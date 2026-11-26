const test = require("node:test");
const assert = require("node:assert/strict");
const { determineDonorEligibility } = require("./check-donor-eligibility");

const now = new Date("2026-03-15T12:00:00Z");
const screenedDonor = {
  user_id: 17,
  username: "test-donor",
  blood_group: "O+",
  is_available: 1,
  last_screening_date: "2026-03-01T10:00:00Z",
  last_donation_date: "2025-12-01T10:00:00Z",
  total_donations: 2,
};

test("requires a recorded screening before marking a donor eligible", () => {
  const result = determineDonorEligibility(
    { ...screenedDonor, last_screening_date: null },
    now
  );

  assert.equal(result.eligibilityStatus, "Pending - Screening Required");
  assert.equal(result.canDonate, "No - See issues below");
});

test("marks a screened donor with no flagged conditions eligible after the interval", () => {
  const result = determineDonorEligibility(screenedDonor, now);

  assert.equal(result.eligibilityStatus, "Eligible");
  assert.equal(result.canDonate, "Yes");
});

test("defers donors with a positive infection flag for clinical review", () => {
  const result = determineDonorEligibility(
    { ...screenedDonor, has_hiv: 1 },
    now
  );

  assert.equal(result.eligibilityStatus, "Not Eligible - HIV");
  assert.equal(result.canDonate, "No - See issues below");
});

test("does not mark an unavailable donor eligible", () => {
  const result = determineDonorEligibility(
    { ...screenedDonor, is_available: 0 },
    now
  );

  assert.equal(result.eligibilityStatus, "Not Available");
  assert.equal(result.canDonate, "No - See issues below");
});

test("enforces the waiting period after a recent donation", () => {
  const result = determineDonorEligibility(
    { ...screenedDonor, last_donation_date: "2026-03-01T10:00:00Z" },
    now
  );

  assert.equal(result.eligibilityStatus, "Pending - Waiting Period");
});
