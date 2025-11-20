const axios = require('axios');

function createClient(settings) {
  const baseURL = settings.prestashop_api_url?.replace(/\/$/, '');
  return axios.create({
    baseURL,
    auth: {
      username: settings.prestashop_api_key,
      password: '',
    },
    headers: {
      Accept: 'application/json',
    },
    params: {
      output_format: 'JSON',
    },
  });
}

async function fetchOrders(settings) {
  const client = createClient(settings);

  const params = {
    display: 'full',
    sort: '[id_DESC]',
    limit: '25',
    'filter[current_state]': '[2|4|5|9|11|15|17|26]'
  };

  const { data } = await client.get('orders', { params });
  const orders = data.orders || [];
  if (Array.isArray(orders)) return orders.reverse();
  return orders.order || [];
}

async function fetchOrderDetails(settings, orderId) {
  const client = createClient(settings);
  const { data } = await client.get('order_details', {
    params: {
      display: 'full',
      'filter[id_order]': orderId,
    },
  });
  const details = data.order_details || [];
  if (Array.isArray(details)) {
    return details;
  }
  return details.order_detail || [];
}

async function fetchBrands(settings) {
  const client = createClient(settings);
  const { data } = await client.get('manufacturers', {
    params: { display: 'full' },
  });
  const manufacturers = data.manufacturers || [];
  if (Array.isArray(manufacturers)) return manufacturers;
  return manufacturers.manufacturer || [];
}

async function fetchProductDetails(settings, productId) {
  const client = createClient(settings);
  const { data } = await client.get(`products/${productId}`, {
    params: { display: 'full' },
  });
  const productDetails = data.products[0] || [];
  if (productDetails) return productDetails;
  return null;
}

async function fetchOrderCartRules(settings, orderId) {
  const client = createClient(settings);
  try {
    const { data } = await client.get(`order_cart_rules`, {
      params: {
        display: 'full',
        "filter[id_order]": orderId
      },
    });
    const cartRulesNode = data?.order_cart_rules;
    if (cartRulesNode) return [].concat(cartRulesNode);
  } catch (error) {
    console.error(`Error fetching cart rules for order ${orderId}:`, error.message);
  }
  return [];
}

async function fetchCartRuleDetails(settings, cartRuleId) {
  const client = createClient(settings);
  try {
    const { data } = await client.get(`cart_rules/${cartRuleId}`, {
      params: { display: 'full' },
    });
    return data.cart_rules[0] || null;
  } catch (error) {
    console.error(`Error fetching details for cart rule ${cartRuleId}:`, error.message);
    return null;
  }
}

module.exports = {
  fetchOrders,
  fetchOrderDetails,
  fetchBrands,
  fetchOrderCartRules,
  fetchCartRuleDetails,
  fetchProductDetails
};
