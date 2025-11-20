const db = require('../config/database');

async function listBrands() {
  const [rows] = await db.query('SELECT * FROM brands ORDER BY name');
  return rows;
}

async function upsertBrand(prestashopBrandId, name) {
  await db.query(
    `INSERT INTO brands (prestashop_brand_id, name)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [prestashopBrandId, name],
  );
}

async function findBrandByPrestashopId(prestashopBrandId) {
  const [rows] = await db.query(
    'SELECT * FROM brands WHERE prestashop_brand_id = ?',
    [prestashopBrandId],
  );
  return rows[0] || null;
}

module.exports = {
  listBrands,
  upsertBrand,
  findBrandByPrestashopId,
};
