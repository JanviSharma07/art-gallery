const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.detail ||
      data?.message ||
      `Request failed with status ${response.status}`
    );
  }

  return data;
}

export async function getArtworks() {
  return request("/artworks");
}

export async function registerUser(name, email) {
  return request("/register", {
    method: "POST",
    body: JSON.stringify({ name, email })
  });
}

export async function createOrder(userId, artworkId) {
  return request("/orders", {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      artwork_id: artworkId
    })
  });
}

export async function getOrder(orderId) {
  return request(`/orders/${orderId}`);
}

export async function getAdminStats(key) {
  return request(`/admin/stats?key=${encodeURIComponent(key)}`);
}

export { API_URL };