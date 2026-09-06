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

export async function registerUser(data) {
  return request("/register", {
    method: "POST",
    body: JSON.stringify({
      username: data.username,
      email: data.email,
      password: data.password
    })
  });
}

export async function loginUser(data) {
  return request("/login", {
    method: "POST",
    body: JSON.stringify({
      login: data.login,
      password: data.password
    })
  });
}

export async function getCurrentUser() {
  const token = localStorage.getItem("atelier_token");

  if (!token) {
    return null;
  }

  try {
    return await request("/me", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  } catch (error) {
    localStorage.removeItem("atelier_token");
    localStorage.removeItem("atelier_user");

    return null;
  }
}

export function logoutUser() {
  localStorage.removeItem("atelier_token");
  localStorage.removeItem("atelier_user");
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
