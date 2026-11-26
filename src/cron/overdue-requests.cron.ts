// Cron job: Mark overdue open blood requests as expired
// Runs every hour to check for open requests that should be expired
// A request is considered overdue if it's been open for more than 7 days

import { runQuery, runQueryOne } from "../database/pool";

export const markOverdueRequestsExpired = async (): Promise<number> => {
  try {
    // Find all open requests that are older than 7 days
    const overdueResults = await runQuery(
      `SELECT request_id, user_id FROM blood_requests r
       WHERE r.status = 'open'
         AND r.created_at < (CURRENT_TIMESTAMP - INTERVAL '7' DAY)`
    );

    const count = overdueResults.length;

    // Update each overdue request to expired
    for (const request of overdueResults) {
      await runQueryOne(
        `UPDATE blood_requests SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE request_id = :1`,
        [request.REQUEST_ID]
      );

      // Log the expiry
      await runQueryOne(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address)
         VALUES (0, 'request_expired', 'blood_requests', :1, 'cron')`,
        [request.REQUEST_ID]
      );
    }

    console.log(`Marked ${count} overdue blood requests as expired`);
    return count;
  } catch (err) {
    console.error("Error marking overdue requests as expired:", err);
    return 0;
  }
};