const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function request(endpoint, options = {}) {
    const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
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
export async function getMyOrders() {
  const token = localStorage.getItem("atelier_token");

  return request("/my-orders", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function changePassword(currentPassword, newPassword) {
  const token = localStorage.getItem("atelier_token");

  return request("/change-password", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword
    })
  });
}
export async function createOrder(artworkId) {
  const token = localStorage.getItem("atelier_token");

  return request("/orders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
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
