import { useEffect, useMemo, useState } from 'react'
import './App.css'

const seedProducts = [
  { id: 'p1', name: 'Wireless Mouse', description: 'Silent clicks, ergonomic grip, all-day battery life.', price: 799, category: 'Tech', stock: 18, icon: '🖱️', color: 'blue' },
  { id: 'p2', name: 'Mechanical Keyboard', description: 'Tactile switches and a compact layout for focused work.', price: 1299, category: 'Tech', stock: 11, icon: '⌨️', color: 'lavender' },
  { id: 'p3', name: 'Studio Headphones', description: 'Immersive sound with plush memory-foam ear cushions.', price: 1999, category: 'Audio', stock: 9, icon: '🎧', color: 'peach' },
  { id: 'p4', name: 'Everyday T-Shirt', description: 'A breathable heavyweight cotton essential in a relaxed fit.', price: 599, category: 'Apparel', stock: 24, icon: '👕', color: 'mint' },
  { id: 'p5', name: 'Runner Sneakers', description: 'Lightweight cushioning built for commutes and weekend miles.', price: 2499, category: 'Footwear', stock: 7, icon: '👟', color: 'yellow' },
  { id: 'p6', name: 'Desk Lamp', description: 'Warm adjustable lighting with a clean, minimal silhouette.', price: 899, category: 'Home', stock: 15, icon: '💡', color: 'pink' },
]

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
})

const getStored = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

/* FIXED API URL */
const API_URL = 'https://e-commerce-website-backend-8jgc.onrender.com/api'

const iconByCategory = {
  Tech: '⌨️',
  Audio: '🎧',
  Apparel: '👕',
  Footwear: '👟',
  Home: '💡'
}

const colorByCategory = {
  Tech: 'blue',
  Audio: 'peach',
  Apparel: 'mint',
  Footwear: 'yellow',
  Home: 'pink'
}

const normalizeProduct = (product) => ({
  ...product,
  id: product.id || product._id,
  icon: product.icon || iconByCategory[product.category] || '✦',
  color: product.color || colorByCategory[product.category] || 'lavender',
})

const apiRequest = async (path, options = {}, token) => {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong')
  }

  return data
}

function App() {
  const [session, setSession] = useState(() =>
    getStored('shop_session', null)
  )

  const user = session?.user

  const [products, setProducts] = useState(() =>
    getStored('shop_products', seedProducts)
  )

  const [cart, setCart] = useState(() =>
    getStored('shop_cart', [])
  )

  const [orders, setOrders] = useState(() =>
    getStored('shop_orders', [])
  )

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [view, setView] = useState('shop')
  const [toast, setToast] = useState('')
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    localStorage.setItem('shop_session', JSON.stringify(session))
  }, [session])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 2600)
      return () => clearTimeout(timer)
    }
  }, [toast])

  useEffect(() => {
    if (!session?.token) return

    Promise.all([
      apiRequest('/products', {}, session.token),
      apiRequest('/cart', {}, session.token),
      apiRequest('/orders', {}, session.token)
    ])
      .then(([catalog, cartResponse, orderList]) => {
        setProducts(catalog.map(normalizeProduct))

        setCart(
          (cartResponse.cart || []).map((item) => ({
            ...normalizeProduct(item.productId),
            productId: item.productId._id,
            quantity: item.quantity
          }))
        )

        setOrders(orderList)
      })
      .catch((error) => notify(error.message))
  }, [session])

  const categories = [
    'All',
    ...new Set(products.map((product) => product.category))
  ]

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          (activeCategory === 'All' ||
            product.category === activeCategory) &&
          `${product.name} ${product.description}`
            .toLowerCase()
            .includes(search.toLowerCase())
      ),
    [products, activeCategory, search]
  )

  const cartCount = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  )

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  )

  const notify = (message) => setToast(message)

  const addToCart = async (product) => {
    const existing = cart.find(
      (item) => item.productId === product.id
    )

    if (existing && existing.quantity >= product.stock) {
      return notify('You have reached the available stock.')
    }

    const quantity = (existing?.quantity || 0) + 1

    try {
      const saved = await apiRequest(
        '/cart',
        {
          method: 'POST',
          body: JSON.stringify({
            productId: product.id,
            quantity
          })
        },
        session.token
      )

      setCart(
        saved.cart.map((item) => ({
          ...normalizeProduct(item.productId),
          productId: item.productId._id,
          quantity: item.quantity
        }))
      )

      notify(`${product.name} added to cart`)
    } catch (error) {
      notify(error.message)
    }
  }

  const updateQuantity = async (productId, quantity) => {
    const item = cart.find(
      (entry) => entry.productId === productId
    )

    if (!item) return

    if (quantity > item.stock) {
      return notify('That quantity is not available.')
    }

    try {
      const method = quantity < 1 ? 'DELETE' : 'PUT'

      const path =
        quantity < 1
          ? `/cart/${productId}`
          : `/cart/${productId}`

      const saved = await apiRequest(
        path,
        {
          method,
          ...(quantity > 0
            ? {
                body: JSON.stringify({ quantity })
              }
            : {})
        },
        session.token
      )

      setCart(
        saved.cart.map((entry) => ({
          ...normalizeProduct(entry.productId),
          productId: entry.productId._id,
          quantity: entry.quantity
        }))
      )
    } catch (error) {
      notify(error.message)
    }
  }

  const placeOrder = async () => {
    if (!cart.length) {
      return notify('Your cart is empty.')
    }

    try {
      const order = await apiRequest(
        '/orders',
        {
          method: 'POST'
        },
        session.token
      )

      setOrders([order, ...orders])
      setCart([])

      const catalog = await apiRequest(
        '/products',
        {},
        session.token
      )

      setProducts(catalog.map(normalizeProduct))
      setView('orders')

      notify('Order placed successfully!')
    } catch (error) {
      notify(error.message)
    }
  }

  const logout = () => {
    setSession(null)
    setCart([])
    setOrders([])
    setView('shop')
  }

  if (!user) {
    return (
      <Login
        onLogin={(nextSession) => {
          setSession(nextSession)
          setLoginError('')
        }}
        error={loginError}
        setError={setLoginError}
      />
    )
  }

  return (
    <div className="app-shell">
      {toast && (
        <div className="toast">
          <span>✓</span>
          {toast}
        </div>
      )}

      <header className="topbar">
        <button
          className="brand"
          onClick={() => setView('shop')}
        >
          <span className="brand-mark">N</span>
          <span>
            nook<span className="brand-dot">.</span>
          </span>
        </button>

        <nav>
          <button
            className={view === 'shop' ? 'nav-active' : ''}
            onClick={() => setView('shop')}
          >
            Shop
          </button>

          <button
            className={view === 'orders' ? 'nav-active' : ''}
            onClick={() => setView('orders')}
          >
            My orders
          </button>
        </nav>

        <div className="header-actions">
          <span className="welcome">
            Hi, {user.name.split(' ')[0]}
          </span>

          <button
            className="icon-btn cart-btn"
            aria-label="Open cart"
            onClick={() => setView('cart')}
          >
            🛒
            {cartCount > 0 && <b>{cartCount}</b>}
          </button>

          <button
            className="avatar"
            aria-label="Log out"
            onClick={logout}
          >
            AM
          </button>
        </div>
      </header>

      <main>
        {view === 'shop' && (
          <Shop
            products={filteredProducts}
            categories={categories}
            category={activeCategory}
            setCategory={setActiveCategory}
            search={search}
            setSearch={setSearch}
            addToCart={addToCart}
          />
        )}

        {view === 'cart' && (
          <Cart
            cart={cart}
            total={cartTotal}
            updateQuantity={updateQuantity}
            placeOrder={placeOrder}
            continueShopping={() => setView('shop')}
          />
        )}

        {view === 'orders' && (
          <Orders orders={orders} />
        )}
      </main>

      <footer>
        <span>© 2026 nook.</span>
        <span>Thoughtfully selected, simply delivered.</span>
      </footer>
    </div>
  )
}

function Login({ onLogin, error, setError }) {
  const [email, setEmail] = useState('user@example.com')
  const [password, setPassword] = useState('password123')

  const submit = async (event) => {
    event.preventDefault()

    try {
      const result = await apiRequest(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({
            email,
            password
          })
        }
      )

      onLogin(result)
    } catch (loginFailure) {
      setError(
        loginFailure.message === 'Failed to fetch'
          ? 'The shop API is unavailable. Start the backend and try again.'
          : loginFailure.message
      )
    }
  }

  return (
    <div className="login-page">
      <div className="login-art">
        <div className="art-orb orb-one" />
        <div className="art-orb orb-two" />

        <span className="art-label">
          A SMALL SHOP
          <br />
          FOR BIG IDEAS
        </span>

        <div className="art-card">✦</div>

        <p>
          Curated goods for your
          <br />
          <em>everyday</em> rituals.
        </p>
      </div>

      <div className="login-panel">
        <div className="login-brand">
          <span className="brand-mark">N</span>
          nook<span className="brand-dot">.</span>
        </div>

        <div className="login-copy">
          <p className="eyebrow">WELCOME BACK</p>

          <h1>
            Good things
            <br />
            <i>await.</i>
          </h1>

          <p>
            Sign in to continue to your personal nook.
          </p>
        </div>

        <form onSubmit={submit}>
          <label>
            Email address

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            Password

            <div className="password-wrap">
              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                required
              />

              <span>⌘</span>
            </div>
          </label>

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}

          <button
            className="primary-btn login-btn"
            type="submit"
          >
            Enter the nook <span>↗</span>
          </button>
        </form>

        <p className="demo-hint">
          Demo access:{' '}
          <strong>user@example.com</strong> /{' '}
          <strong>password123</strong>
        </p>
      </div>
    </div>
  )
}

function Shop({
  products,
  categories,
  category,
  setCategory,
  search,
  setSearch,
  addToCart
}) {
  return (
    <>
      <section className="hero-section">
        <div>
          <p className="eyebrow">
            THE NOOK EDIT / 01
          </p>

          <h1>
            Objects with
            <br />
            <i>intention.</i>
          </h1>

          <p className="hero-subtitle">
            A considered collection of things
            <br />
            that make everyday life feel better.
          </p>
        </div>

        <div className="hero-stamp">
          N
          <br />
          <small>EST. 2026</small>
        </div>
      </section>

      <section className="catalog-toolbar">
        <div className="categories">
          {categories.map((item) => (
            <button
              key={item}
              className={
                category === item
                  ? 'category-active'
                  : ''
              }
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <label className="search-box">
          <span>⌕</span>

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search the collection..."
          />

          <kbd>⌘ K</kbd>
        </label>
      </section>

      <section className="product-grid">
        {products.map((product, index) => (
          <ProductCard
            product={product}
            key={product.id}
            addToCart={addToCart}
            index={index}
          />
        ))}
      </section>

      {!products.length && (
        <div className="empty-state">
          No objects found. Try another search.
        </div>
      )}
    </>
  )
}

function ProductCard({
  product,
  addToCart,
  index
}) {
  return (
    <article className="product-card">
      <div
        className={`product-image ${product.color}`}
      >
        <span className="product-icon">
          {product.icon}
        </span>

        <span className="product-number">
          0{index + 1}
        </span>

        {product.stock < 10 && (
          <span className="low-stock">
            Only {product.stock} left
          </span>
        )}
      </div>

      <div className="product-info">
        <div>
          <p className="product-category">
            {product.category}
          </p>

          <h3>{product.name}</h3>

          <p className="product-description">
            {product.description}
          </p>
        </div>

        <div className="product-bottom">
          <strong>
            {money.format(product.price)}
          </strong>

          <button
            className="add-btn"
            onClick={() => addToCart(product)}
          >
            Add <span>+</span>
          </button>
        </div>
      </div>
    </article>
  )
}

function Cart({
  cart,
  total,
  updateQuantity,
  placeOrder,
  continueShopping
}) {
  return (
    <section className="cart-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            YOUR SELECTION
          </p>

          <h1>
            Your cart <span>{cart.length}</span>
          </h1>
        </div>

        <button
          className="text-btn"
          onClick={continueShopping}
        >
          ← Continue shopping
        </button>
      </div>

      {cart.length ? (
        <div className="cart-layout">
          <div className="cart-items">
            {cart.map((item) => (
              <div
                className="cart-item"
                key={item.productId}
              >
                <div
                  className={`cart-thumb ${item.color}`}
                >
                  {item.icon}
                </div>

                <div className="cart-item-main">
                  <p className="product-category">
                    ITEM
                  </p>

                  <h3>{item.name}</h3>

                  <p>
                    {money.format(item.price)} each
                  </p>
                </div>

                <div className="quantity">
                  <button
                    onClick={() =>
                      updateQuantity(
                        item.productId,
                        item.quantity - 1
                      )
                    }
                  >
                    −
                  </button>

                  <span>{item.quantity}</span>

                  <button
                    onClick={() =>
                      updateQuantity(
                        item.productId,
                        item.quantity + 1
                      )
                    }
                  >
                    +
                  </button>
                </div>

                <strong>
                  {money.format(
                    item.price * item.quantity
                  )}
                </strong>

                <button
                  className="remove-btn"
                  onClick={() =>
                    updateQuantity(
                      item.productId,
                      0
                    )
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <aside className="summary">
            <p className="eyebrow">
              ORDER SUMMARY
            </p>

            <div>
              <span>Subtotal</span>
              <strong>
                {money.format(total)}
              </strong>
            </div>

            <div>
              <span>Delivery</span>
              <strong className="free">
                FREE
              </strong>
            </div>

            <hr />

            <div className="summary-total">
              <span>Total</span>
              <strong>
                {money.format(total)}
              </strong>
            </div>

            <button
              className="primary-btn place-btn"
              onClick={placeOrder}
            >
              Place order <span>↗</span>
            </button>

            <small>
              Secure checkout · Stock validated at
              purchase
            </small>
          </aside>
        </div>
      ) : (
        <div className="empty-state cart-empty">
          <span>🛒</span>

          <h2>Your cart is waiting.</h2>

          <p>
            Add something lovely to get started.
          </p>

          <button
            className="primary-btn"
            onClick={continueShopping}
          >
            Browse collection
          </button>
        </div>
      )}
    </section>
  )
}

function Orders({ orders }) {
  return (
    <section className="orders-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            A LITTLE RECORD
          </p>

          <h1>
            My orders <span>{orders.length}</span>
          </h1>
        </div>
      </div>

      {orders.length ? (
        <div className="orders-list">
          {orders.map((order) => (
            <article
              className="order-card"
              key={order.id}
            >
              <div>
                <p className="product-category">
                  {order.id} ·{' '}
                  {new Date(
                    order.createdAt
                  ).toLocaleDateString('en-IN')}
                </p>

                <h3>
                  {order.items
                    .map((item) => item.name)
                    .join(', ')}
                </h3>

                <p>
                  {order.items.reduce(
                    (sum, item) =>
                      sum + item.quantity,
                    0
                  )}{' '}
                  items
                </p>
              </div>

              <div className="order-right">
                <span className="status">
                  {order.status}
                </span>

                <strong>
                  {money.format(
                    order.totalAmount
                  )}
                </strong>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span>✦</span>

          <h2>No orders yet.</h2>

          <p>
            Your considered collection will appear
            here.
          </p>
        </div>
      )}
    </section>
  )
}

export default App