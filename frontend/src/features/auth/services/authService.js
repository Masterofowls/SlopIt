
class AuthService {
  constructor() {
    this.tokenKey = 'auth_token';
    this.userKey = 'user_data';
  }

  async login(credentials) {

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!credentials.email || !credentials.password) {
          reject(new Error('Email and password are required'));
          return;
        }

        const mockResponse = {
          token: 'mock-jwt-token-' + Date.now(),
          user: {
            id: 1,
            email: credentials.email,
            name: 'Demo User'
          }
        };

        this.setToken(mockResponse.token);
        this.setUser(mockResponse.user);
        resolve(mockResponse);
      }, 1000);
    });
  }

  async signup(userData) {

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!userData.name || !userData.email || !userData.password) {
          reject(new Error('Name, email, and password are required'));
          return;
        }

        if (userData.password !== userData.confirmPassword) {
          reject(new Error('Passwords do not match'));
          return;
        }

        const mockResponse = {
          token: 'mock-jwt-token-' + Date.now(),
          user: {
            id: Date.now(),
            email: userData.email,
            name: userData.name
          }
        };

        this.setToken(mockResponse.token);
        this.setUser(mockResponse.user);
        resolve(mockResponse);
      }, 1000);
    });
  }

  logout() {
    this.removeToken();
    this.removeUser();
  }


  getToken() {
    return localStorage.getItem(this.tokenKey);
  }


  setToken(token) {
    localStorage.setItem(this.tokenKey, token);
  }


  removeToken() {
    localStorage.removeItem(this.tokenKey);
  }


  getUser() {
    const userData = localStorage.getItem(this.userKey);
    return userData ? JSON.parse(userData) : null;
  }


  setUser(user) {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }


  removeUser() {
    localStorage.removeItem(this.userKey);
  }

  isAuthenticated() {
    return !!this.getToken();
  }


  mockUser() {
    const mockResponse = {
      token: "mock-jwt-token-" + Date.now(),
      user: {
        id: 1,
        email: "demo@example.com",
        name: "Demo User"
      }
    };
    this.setToken(mockResponse.token);
    this.setUser(mockResponse.user);
    return mockResponse;
  }
}

export default new AuthService();
