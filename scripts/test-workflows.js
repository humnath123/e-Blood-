const assert = require("node:assert/strict");
const test = require("node:test");
const { canTransition, eventTransitions, transportTransitions } = require("../dist/services/workflows");
const {
  buildDonationCertificateEmail,
  certificateEmailSubject,
  certificateLogoCid,
} = require("../dist/services/donation-certificate-email");

test("transport workflow permits ordered progress and explicit exception outcomes", () => {
  assert.equal(canTransition(transportTransitions, "PENDING", "APPROVED"), true);
  assert.equal(canTransition(transportTransitions, "APPROVED", "ASSIGNED"), true);
  assert.equal(canTransition(transportTransitions, "IN_TRANSIT", "DELAYED"), true);
  assert.equal(canTransition(transportTransitions, "PENDING", "DELIVERED"), false);
  assert.equal(canTransition(transportTransitions, "COMPLETED", "IN_TRANSIT"), false);
});

test("donation event workflow keeps draft, registration, and terminal states ordered", () => {
  assert.equal(canTransition(eventTransitions, "DRAFT", "PUBLISHED"), true);
  assert.equal(canTransition(eventTransitions, "PUBLISHED", "REGISTRATION_OPEN"), true);
  assert.equal(canTransition(eventTransitions, "REGISTRATION_OPEN", "ONGOING"), false);
  assert.equal(canTransition(eventTransitions, "COMPLETED", "PUBLISHED"), false);
  assert.equal(canTransition(eventTransitions, "POSTPONED", "PUBLISHED"), true);
});

test("certificate email uses the required subject, actual donor name, inline logo, and escaped HTML", () => {
  const email = buildDonationCertificateEmail("<Donor & Test>", "EBLD-TEST-001");
  assert.equal(certificateEmailSubject, "Your Blood Donation Certificate – e-Blood");
  assert.equal(email.subject, certificateEmailSubject);
  assert.match(email.text, /Dear <Donor & Test>/);
  assert.match(email.html, /Dear &lt;Donor &amp; Test&gt;/);
  assert.match(email.html, /cid:eblood-certificate-logo/);
  assert.match(email.html, /EBLD-TEST-001/);
  assert.match(email.text, /Humnath Pokharel and Surav Bogati/);
  assert.match(email.html, /CEOs, e-Blood/);
  assert.equal(email.html.includes("<Donor & Test>"), false);
  assert.equal(certificateLogoCid, "eblood-certificate-logo");
});
