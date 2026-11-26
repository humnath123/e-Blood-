const oracledb = require("oracledb");
const CONN = { user: "EBLOOD_APP", password: "EbloodDb_26ai_Rotate_7xQ9", connectString: "localhost:1521/FREEPDB1" };
oracledb.getConnection(CONN, (err, conn) => {
  if (err) { console.log("ERR", err.message); process.exit(1); }
  conn.execute(
    "SELECT column_name FROM user_tab_columns WHERE table_name = 'USERS' ORDER BY column_id",
    (e2, r2) => {
      if (e2) { console.log("Q ERR", e2.message); conn.close(); process.exit(0); }
      console.log("USERS columns:", r2.rows.join(", "));
      conn.execute(
        "SELECT column_name FROM user_tab_columns WHERE table_name = 'DONATIONS' ORDER BY column_id",
        (e3, r3) => {
          if (e3) { console.log("Q2 ERR", e3.message); }
          else { console.log("DONATIONS columns:", r3.rows.join(", ")); }
          conn.close();
        }
      );
    }
  );
});
