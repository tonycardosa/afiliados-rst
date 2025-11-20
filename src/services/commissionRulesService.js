const db = require('../config/database');

async function listRules() {
  const [rows] = await db.query(
    `SELECT cr.*, u.name AS influencer_name, b.name AS brand_name
     FROM commission_rules cr
     JOIN users u ON u.id = cr.user_id
     LEFT JOIN brands b ON b.id = cr.brand_id
     ORDER BY u.name, b.name`,
  );
  return rows;
}

async function listRulesByAfiliado(influencerId) {
  const [rows] = await db.query(
    `SELECT cr.*, b.name AS brand_name
     FROM commission_rules cr
     LEFT JOIN brands b ON b.id = cr.brand_id
     WHERE cr.user_id = ?
     ORDER BY brand_name`,
    [influencerId],
  );
  return rows;
}

async function upsertRule({ userId, brandId, commissionFirst, commissionSubsequent }) {
  await db.query(
    `INSERT INTO commission_rules (user_id, brand_id, commission_first, commission_subsequent)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       commission_first = VALUES(commission_first),
       commission_subsequent = VALUES(commission_subsequent)`,
    [userId, brandId || null, commissionFirst, commissionSubsequent],
  );
}

async function deleteRule(id) {
  await db.query('DELETE FROM commission_rules WHERE id = ?', [id]);
}

async function findRuleForAfiliadoAndBrand(influencerId, brandId) {
  const params = [influencerId];
  let sql = 'SELECT * FROM commission_rules WHERE user_id = ? AND ';
  if (brandId !== null && brandId !== undefined) {
    sql += 'brand_id = ?';
    params.push(brandId);
  } else {
    sql += 'brand_id IS NULL';
  }

  const [rows] = await db.query(sql, params);
  return rows[0] || null;
}

module.exports = {
  listRules,
  listRulesByAfiliado,
  upsertRule,
  deleteRule,
  findRuleForAfiliadoAndBrand,
};
