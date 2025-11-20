const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { isAuthenticated } = require('../middleware/auth');
const {
  getTotalsForAdmin,
  getTotalsForAfiliado,
  listCommissionOrders,
} = require('../services/commissionService');

const router = express.Router();

router.get(
  '/dashboard',
  isAuthenticated,
  asyncHandler(async (req, res) => {
    if (req.session.userRole === 'admin') {
      const totals = await getTotalsForAdmin();
      const orders = await listCommissionOrders({ limit: 50 });
      return res.render('admin_dashboard', { title: 'Dashboard', totals, orders });
    }

    const totals = await getTotalsForAfiliado(req.session.userId);
    const orders = await listCommissionOrders({ afiliadoId: req.session.userId, limit: 50 });
    return res.render('influencer_dashboard', { title: 'Dashboard', totals, orders });
  }),
);

module.exports = router;