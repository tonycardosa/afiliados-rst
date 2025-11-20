const dayjs = require('dayjs');
const db = require('../config/database');

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function storeOtp(email, otpCode) {
  const expiresAt = dayjs().add(10, 'minute').toDate();
  await db.query(
    `INSERT INTO otps (email, otp_code, expires_at)
     VALUES (?, ?, ?)
    `,
    [email, otpCode, expiresAt],
  );
}

async function verifyOtp(email, otpCode) {
  const now = dayjs().toDate();
  const [rows] = await db.query(
    `SELECT * FROM otps WHERE email = ? AND otp_code = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 1`,
    [email, otpCode, now],
  );

  if (!rows.length) {
    return false;
  }

  await db.query('DELETE FROM otps WHERE id = ?', [rows[0].id]);
  return true;
}

async function purgeExpiredOtps() {
  const now = dayjs().toDate();
  await db.query('DELETE FROM otps WHERE expires_at <= ?', [now]);
}

module.exports = {
  generateOtp,
  storeOtp,
  verifyOtp,
  purgeExpiredOtps,
};
