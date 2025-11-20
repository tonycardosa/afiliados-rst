const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const {
  listAfiliados,
  createAfiliado,
  getUserWithDiscountCodes,
  addDiscountCode,
  removeDiscountCode,
} = require('../services/userService');
const { listBrands, upsertBrand } = require('../services/brandService');
const {
  listRules,
  upsertRule,
  deleteRule,
} = require('../services/commissionRulesService');
const {
  getPendingPayouts,
  markCommissionsAsPaid,
  syncOrders,
  deleteCommissionById,
} = require('../services/commissionService');
const { getSettings } = require('../services/settingsService');
const prestashopService = require('../services/prestashopService');

const router = express.Router();

function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

router.use(isAuthenticated, isAdmin);

router.get(
  '/admin/influencers',
  asyncHandler(async (req, res) => {
    const influencers = await listAfiliados();
    res.render('admin_influencers', { title: 'Afiliados', influencers });
  }),
);

router.post(
  '/admin/influencers',
  asyncHandler(async (req, res) => {
    const { name, email } = req.body;
    if (!name || !email) {
      setFlash(req, 'error', 'Nome e email são obrigatórios.');
      return res.redirect('/admin/influencers');
    }
    await createAfiliado({ name, email });
    setFlash(req, 'success', 'Afiliado criado com sucesso.');
    res.redirect('/admin/influencers');
  }),
);

router.get(
  '/admin/influencers/:id',
  asyncHandler(async (req, res) => {
    const influencer = await getUserWithDiscountCodes(req.params.id);
    if (!influencer) {
      return res.status(404).render('errors/404', { title: 'Não encontrado' });
    }
    res.render('admin_influencer_edit', { title: 'Editar afiliado', influencer });
  }),
);

router.post(
  '/admin/influencers/:id/codes',
  asyncHandler(async (req, res) => {
    const { prestashop_code: code } = req.body;
    if (!code) {
      setFlash(req, 'error', 'Código obrigatório.');
      return res.redirect(`/admin/influencers/${req.params.id}`);
    }
    await addDiscountCode(req.params.id, code.trim());
    setFlash(req, 'success', 'Código adicionado.');
    res.redirect(`/admin/influencers/${req.params.id}`);
  }),
);

router.post(
  '/admin/influencers/:id/codes/:codeId/delete',
  asyncHandler(async (req, res) => {
    await removeDiscountCode(req.params.codeId);
    setFlash(req, 'success', 'Código removido.');
    res.redirect(`/admin/influencers/${req.params.id}`);
  }),
);

router.get(
  '/admin/brands',
  asyncHandler(async (req, res) => {
    const brands = await listBrands();
    res.render('admin_brands', { title: 'Marcas', brands });
  }),
);

router.post(
  '/admin/brands/sync',
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    if (!settings.prestashop_api_key || !settings.prestashop_api_url) {
      setFlash(req, 'error', 'Defina PRESTASHOP_API_URL e PRESTASHOP_API_KEY no .env antes de sincronizar.');
      return res.redirect('/admin/brands');
    }

    const manufacturers = await prestashopService.fetchBrands(settings);
    let imported = 0;
    for (const manufacturer of manufacturers) {
      await upsertBrand(manufacturer.id, manufacturer.name);
      imported += 1;
    }
    setFlash(req, 'success', `${imported} marcas sincronizadas.`);
    res.redirect('/admin/brands');
  }),
);

router.get(
  '/admin/rules',
  asyncHandler(async (req, res) => {
    const influencers = await listAfiliados();
    const brands = await listBrands();
    const rules = await listRules();
    res.render('admin_rules', { title: 'Regras de comissão', influencers, brands, rules });
  }),
);

router.post(
  '/admin/rules',
  asyncHandler(async (req, res) => {
    const { user_id: userId, brand_id: brandId, commission_first: first, commission_subsequent: subsequent } =
      req.body;
    if (!userId || !first || !subsequent) {
      setFlash(req, 'error', 'Preencha todos os campos obrigatórios.');
      return res.redirect('/admin/rules');
    }
    await upsertRule({
      userId,
      brandId: brandId || null,
      commissionFirst: first,
      commissionSubsequent: subsequent,
    });
    setFlash(req, 'success', 'Regra guardada.');
    res.redirect('/admin/rules');
  }),
);

router.post(
  '/admin/rules/:id/delete',
  asyncHandler(async (req, res) => {
    await deleteRule(req.params.id);
    setFlash(req, 'success', 'Regra removida.');
    res.redirect('/admin/rules');
  }),
);

router.get(
  '/admin/payouts',
  asyncHandler(async (req, res) => {
    const payouts = await getPendingPayouts();
    res.render('admin_payouts', { title: 'Pagamentos', payouts });
  }),
);

router.post(
  '/admin/payouts/mark-paid',
  asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body.commission_ids)
      ? req.body.commission_ids
      : req.body.commission_ids
        ? [req.body.commission_ids]
        : [];
    if (!ids.length) {
      setFlash(req, 'error', 'Selecione pelo menos uma comissão.');
      return res.redirect('/admin/payouts');
    }
    await markCommissionsAsPaid(ids);
    setFlash(req, 'success', 'Comissões marcadas como pagas.');
    res.redirect('/admin/payouts');
  }),
);

router.post(
  '/admin/orders/sync',
  asyncHandler(async (req, res) => {
    const imported = await syncOrders();
    setFlash(req, 'success', `${imported} encomendas sincronizadas.`);
    res.redirect('/dashboard');
  }),
);

router.post(
  '/admin/orders/:id/delete',
  asyncHandler(async (req, res) => {
    const commissionId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(commissionId) || commissionId <= 0) {
      setFlash(req, 'error', 'Encomenda inválida.');
      return res.redirect('/dashboard');
    }
    await deleteCommissionById(commissionId);
    setFlash(req, 'success', 'Encomenda removida. Pode ser sincronizada novamente se uma regra se aplicar.');
    res.redirect('/dashboard');
  }),
);

module.exports = router;
