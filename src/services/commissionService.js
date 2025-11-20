const dayjs = require('dayjs');
const db = require('../config/database');
const { getSettings } = require('./settingsService');
const prestashopService = require('./prestashopService');
const { findBrandByPrestashopId } = require('./brandService');
const { findRuleForAfiliadoAndBrand } = require('./commissionRulesService');

async function getTotalsForAdmin() {
  const [[pending]] = await db.query(
    'SELECT SUM(commission_earned) AS total FROM commissions WHERE status = "pending"',
  );
  const [[paid]] = await db.query(
    'SELECT SUM(commission_earned) AS total FROM commissions WHERE status = "paid"',
  );
  return {
    totalPending: Number(pending.total || 0),
    totalPaid: Number(paid.total || 0),
  };
}

async function getTotalsForAfiliado(afiliadoId) {
  const [[pending]] = await db.query(
    'SELECT SUM(commission_earned) AS total FROM commissions WHERE status = "pending" AND afiliado_id = ?',
    [afiliadoId],
  );
  const [[paid]] = await db.query(
    'SELECT SUM(commission_earned) AS total FROM commissions WHERE status = "paid" AND afiliado_id = ?',
    [afiliadoId],
  );
  return {
    totalPending: Number(pending.total || 0),
    totalPaid: Number(paid.total || 0),
  };
}

async function getPendingPayouts() {
  const [rows] = await db.query(
    `SELECT c.*, u.name AS afiliado_name
     FROM commissions c
     JOIN users u ON u.id = c.afiliado_id
     WHERE c.status = 'pending'
     ORDER BY u.name, c.order_created_at DESC`,
  );
  return rows;
}

async function markCommissionsAsPaid(ids) {
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(',');
  await db.query(
    `UPDATE commissions SET status = 'paid', paid_at = NOW() WHERE id IN (${placeholders})`,
    ids,
  );
}

async function getLastPrestashopOrderId() {
  const [[row]] = await db.query(
    'SELECT prestashop_order_id FROM commissions ORDER BY prestashop_order_id DESC LIMIT 1',
  );
  return row ? row.prestashop_order_id : null;
}

async function findCustomerByPrestashopId(id) {
  const [rows] = await db.query('SELECT * FROM customers WHERE prestashop_customer_id = ?', [id]);
  return rows[0] || null;
}

async function createOrUpdateCustomer({ prestashopCustomerId, afiliadoId, email = null }) {
  const existing = await findCustomerByPrestashopId(prestashopCustomerId);
  if (existing) {
    if (existing.id_current_afiliate !== afiliadoId) {
      await db.query('UPDATE customers SET id_current_afiliate = ? WHERE id = ?', [
        afiliadoId,
        existing.id,
      ]);
    }
    return { ...existing, id_current_afiliate: afiliadoId };
  }

  const [result] = await db.query(
    'INSERT INTO customers (prestashop_customer_id, email, id_current_afiliate) VALUES (?, ?, ?)',
    [prestashopCustomerId, email, afiliadoId],
  );

  return {
    id: result.insertId,
    prestashop_customer_id: prestashopCustomerId,
    email,
    id_current_afiliate: afiliadoId,
  };
}

async function countCustomerCommissions(customerId) {
  const [[row]] = await db.query('SELECT COUNT(*) AS total FROM commissions WHERE customer_id = ?', [
    customerId,
  ]);
  return Number(row.total || 0);
}

async function deleteCommissionById(commissionId) {
  if (!commissionId) return;
  await db.query('DELETE FROM commissions WHERE id = ?', [commissionId]);
}

async function findCommissionByPrestashopOrderId(prestashopOrderId) {
  const [rows] = await db.query(
    'SELECT id FROM commissions WHERE prestashop_order_id = ? LIMIT 1',
    [prestashopOrderId],
  );
  return rows[0] || null;
}

async function insertCommission({
  prestashopOrderId,
  customerId,
  afiliadoId,
  orderTotalWithVat,
  commissionEarned,
  isFirstPurchase,
  orderCreatedAt,
}) {
  await db.query(
    `INSERT INTO commissions 
      (prestashop_order_id, customer_id, afiliado_id, order_total_with_vat, commission_earned, is_first_purchase_commission, status, order_created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `,
    [
      prestashopOrderId,
      customerId,
      afiliadoId,
      orderTotalWithVat,
      commissionEarned,
      isFirstPurchase ? 1 : 0,
      orderCreatedAt,
    ],
  );
}
async function findBrandByProductPrestashopId(productId) {
  const settings = await getSettings();
  const productDetails = await prestashopService.fetchProductDetails(settings, productId);
  if(productDetails){
    const brandDetails = await findBrandByPrestashopId(productDetails.id_manufacturer);
    if(brandDetails){
      return brandDetails ?? null;
    }
  }
  return null;
}
async function determineAfiliadoFromOrder(order, cartRules, settings) {
  if (cartRules.length) {
    for (const rule of cartRules) {
      // The rule from order associations only has the ID. We need to fetch the full rule.
      const ruleDetails = await prestashopService.fetchCartRuleDetails(settings, rule.id_cart_rule);
      const code = ruleDetails?.code;
      if (!code) continue;
      const [rows] = await db.query('SELECT * FROM discount_codes WHERE prestashop_code = ?', [
        code,
      ]);
      if (rows.length) {
        return rows[0].user_id;
      }
    }
  }

  // fallback: existing customer
  const [customers] = await db.query('SELECT * FROM customers WHERE prestashop_customer_id = ?', [
    order.id_customer,
  ]);
  if (customers.length) {
    return customers[0].id_current_afiliate;
  }
  return null;
}

async function calculateCommissionForOrder({ order, orderDetails, afiliadoId, isFirst }) {
  let commissionTotal = 0;
  let orderTotalWithVat = 0;

  const productsArray = (order.associations && order.associations.order_rows && Array.isArray(order.associations.order_rows))
    ? order.associations.order_rows
    : [];
  const orderDetailsMap = new Map();
  for (const detail of Array.isArray(orderDetails) ? orderDetails : []) {
    const detailProductId = Number(detail.product_id);
    if (!Number.isNaN(detailProductId) && !orderDetailsMap.has(detailProductId)) {
      orderDetailsMap.set(detailProductId, detail);
    }
  }
  const brandCache = new Map();

  for (const product of productsArray) {
    const price = Number(product.unit_price_tax_incl || 0);
    orderTotalWithVat += price;

    const productId = Number(product.product_id);
    let brand = await findBrandByProductPrestashopId(productId) ?? null;
    brandCache.set(brand.id, brand.name);

    let rule = null;
    if (brand) {
      rule = await findRuleForAfiliadoAndBrand(afiliadoId, brand.id);
    }
    if (!rule) {
      rule = await findRuleForAfiliadoAndBrand(afiliadoId, null);
    }

    if (!rule) {
      continue;
    }

    const percentage = isFirst ? rule.commission_first : rule.commission_subsequent;
    commissionTotal += price * (Number(percentage) / 100);
  }

  return { commissionTotal, orderTotalWithVat };
}

async function listCommissionOrders({ afiliadoId = null, limit = 50 } = {}) {
  const settings = await getSettings();
  const hasPrestashopCredentials = Boolean(settings.prestashop_api_key && settings.prestashop_api_url);

  const params = [];
  const parsedLimit = Number.parseInt(limit, 10);
  // MySQL LIMIT with prepared statements can be picky; embed a sanitized integer instead of a placeholder.
  const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50;
  let whereClause = '';
  if (afiliadoId !== null && afiliadoId !== undefined) {
    whereClause = 'WHERE c.afiliado_id = ?';
    params.push(afiliadoId);
  }

  const sql = `SELECT c.*, u.name AS afiliado_name
     FROM commissions c
     JOIN users u ON u.id = c.afiliado_id
     ${whereClause}
     ORDER BY c.order_created_at DESC
     LIMIT ${safeLimit}`;

  const [rows] = await db.query(sql, params);

  const brandCache = new Map();
  const orders = [];

  for (const commission of rows) {
    let orderDetails = [];
    if (hasPrestashopCredentials) {
      try {
        orderDetails = await prestashopService.fetchOrderDetails(settings, commission.prestashop_order_id);
      } catch (error) {
        console.error(`Failed to fetch details for order ${commission.prestashop_order_id}:`, error.message);
      }
    }

    const products = [];
    for (const detail of Array.isArray(orderDetails) ? orderDetails : []) {
      const productId = Number(detail.product_id);
      const quantity = Number(detail.product_quantity || 1);
      const priceBase = Number(detail.total_price_tax_incl || 0);
      const fallbackUnit =
        Number(detail.unit_price_tax_incl || 0) * (Number.isNaN(quantity) ? 1 : quantity);
      const priceWithVat = Number.isNaN(priceBase) || priceBase === 0 ? fallbackUnit : priceBase;

      let prestashopBrandId = null;
      const productDetails = await prestashopService.fetchProductDetails(settings, productId);
      if(productDetails){
        const brandDetails = await findBrandByPrestashopId(productDetails.id_manufacturer);
        if(brandDetails) prestashopBrandId = brandDetails.id;
      }

      if (!Number.isNaN(prestashopBrandId) && prestashopBrandId) {
          brand = await findBrandByPrestashopId(prestashopBrandId);
          brandCache.set(prestashopBrandId, brand || null);
      }

      let rule = null;
      if (brand) {
        rule = await findRuleForAfiliadoAndBrand(commission.afiliado_id, brand.id);
      }
      if (!rule) {
        rule = await findRuleForAfiliadoAndBrand(commission.afiliado_id, null);
      }

      const percentage =
        rule != null
          ? Number(
              commission.is_first_purchase_commission
                ? rule.commission_first
                : rule.commission_subsequent,
            )
          : null;
      const commissionAmount =
        percentage != null ? priceWithVat * (Number(percentage) / 100) : 0;

      const fallbackBrandName = prestashopBrandId ? `Marca ${prestashopBrandId}` : null;

      products.push({
        brandName: brand ? brand.name : fallbackBrandName,
        prestashopBrandId: prestashopBrandId || null,
        productId,
        name: detail.product_name,
        quantity: Number.isNaN(quantity) ? 1 : quantity,
        priceWithVat,
        commissionAmount,
        percentage,
      });
    }

    orders.push({
      ...commission,
      afiliado_name: commission.afiliado_name,
      products,
    });
  }

  return orders;
}

async function syncOrders() {
  const settings = await getSettings();
  if (!settings.prestashop_api_key || !settings.prestashop_api_url) {
    throw new Error('Configure as credenciais da API do Prestashop antes de sincronizar.');
  }

  // Fetch recent orders without relying on the last stored Prestashop order ID
  const orders = await prestashopService.fetchOrders(settings);

  let imported = 0;
  for (const order of orders) {
    const existingCommission = await findCommissionByPrestashopOrderId(order.id);
    if (existingCommission) {
      continue;
    }

    // Fetch cart rules explicitly as they might not be in the order list response
    const cartRules = await prestashopService.fetchOrderCartRules(settings, order.id);
    const afiliadoId = await determineAfiliadoFromOrder(order, cartRules, settings);
    if (!afiliadoId) continue;

    const customer = await createOrUpdateCustomer({
      prestashopCustomerId: order.id_customer,
      afiliadoId,
      email: order?.email || null,
    });
    const previousCount = await countCustomerCommissions(customer.id);
    const isFirst = previousCount === 0;

    const orderDetails = await prestashopService.fetchOrderDetails(settings, order.id);
    const { commissionTotal, orderTotalWithVat } = await calculateCommissionForOrder({
      order,
      orderDetails,
      afiliadoId,
      isFirst,
    });

    if (!commissionTotal) continue;

    await insertCommission({
      prestashopOrderId: order.id,
      customerId: customer.id,
      afiliadoId,
      orderTotalWithVat,
      commissionEarned: commissionTotal,
      isFirstPurchase: isFirst,
      orderCreatedAt: dayjs(order.date_add).toDate(),
    });
    imported += 1;
  }
  return imported;
}

async function listCommissionsByAfiliado(afiliadoId) {
  const [rows] = await db.query(
    `SELECT * FROM commissions 
     WHERE afiliado_id = ?
     ORDER BY order_created_at DESC`,
    [afiliadoId],
  );
  return rows;
}

module.exports = {
  getTotalsForAdmin,
  getTotalsForAfiliado,
  getPendingPayouts,
  markCommissionsAsPaid,
  syncOrders,
  listCommissionsByAfiliado,
  listCommissionOrders,
  deleteCommissionById,
};
