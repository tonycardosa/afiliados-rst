const db = require('../config/database');

async function findUserByEmail(email) {
  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0] || null;
}

async function findUserById(id) {
  const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  return rows[0] || null;
}

async function listAfiliados() {
  const [rows] = await db.query(
    'SELECT id, name, email, created_at FROM users WHERE role = ? ORDER BY created_at DESC',
    ['influencer'],
  );
  return rows;
}

async function createAfiliado({ name, email }) {
  await db.query(
    'INSERT INTO users (name, email, role) VALUES (?, ?, "influencer")',
    [name, email],
  );
}

async function deleteAfiliado(id) {
  const [result] = await db.query('DELETE FROM users WHERE id = ? AND role = "influencer"', [id]);
  return result.affectedRows;
}

async function getUserWithDiscountCodes(id) {
  const [users] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  if (!users.length) {
    return null;
  }

  const [codes] = await db.query(
    `SELECT discount_codes.* FROM discount_codes WHERE user_id = ? ORDER BY prestashop_code`,
    [id],
  );

  return { ...users[0], discountCodes: codes };
}

async function addDiscountCode(userId, code) {
  await db.query(
    'INSERT INTO discount_codes (user_id, prestashop_code) VALUES (?, ?)',
    [userId, code],
  );
}

async function removeDiscountCode(id) {
  await db.query('DELETE FROM discount_codes WHERE id = ?', [id]);
}

module.exports = {
  findUserByEmail,
  findUserById,
  listAfiliados,
  createAfiliado,
  deleteAfiliado,
  getUserWithDiscountCodes,
  addDiscountCode,
  removeDiscountCode,
};
