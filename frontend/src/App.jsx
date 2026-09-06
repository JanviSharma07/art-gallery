import React, { useEffect, useMemo, useState } from "react";

import Auth from "./components/Auth";

import {
  logoutUser,
  getCurrentUser,
  getAdminStats,
  getArtworks,
  getOrder,
  registerUser,
  createOrder
} from "./api";


function formatPrice(price) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(price);
}


function App() {

  /* =========================================
     AUTHENTICATION
  ========================================= */

  const [user, setUser] = useState(() => {
    try {
      const savedUser =
        localStorage.getItem("atelier_user");

      return savedUser
        ? JSON.parse(savedUser)
        : null;

    } catch {
      return null;
    }
  });

  const [authMode, setAuthMode] = useState(null);


  /* =========================================
     GENERAL APP STATE
  ========================================= */

  const [page, setPage] = useState("home");

  const [artworks, setArtworks] = useState([]);

  const [loading, setLoading] = useState(true);

  const [backendError, setBackendError] = useState("");

  const [selectedArtwork, setSelectedArtwork] =
    useState(null);

  const [search, setSearch] = useState("");

  const [artistFilter, setArtistFilter] =
    useState("All");


  /* =========================================
     PURCHASE STATE
  ========================================= */

  const [buyerModal, setBuyerModal] =
    useState(false);

  const [buyerName, setBuyerName] =
    useState("");

  const [buyerEmail, setBuyerEmail] =
    useState("");

  const [purchaseLoading, setPurchaseLoading] =
    useState(false);

  const [purchaseError, setPurchaseError] =
    useState("");

  const [order, setOrder] =
    useState(null);


  /* =========================================
     ORDER TRACKING
  ========================================= */

  const [orderIdInput, setOrderIdInput] =
    useState("");

  const [trackingLoading, setTrackingLoading] =
    useState(false);

  const [trackingError, setTrackingError] =
    useState("");


  /* =========================================
     ADMIN
  ========================================= */

  const [adminKey, setAdminKey] =
    useState("");

  const [adminData, setAdminData] =
    useState(null);

  const [adminLoading, setAdminLoading] =
    useState(false);

  const [adminError, setAdminError] =
    useState("");


  /* =========================================
     LOAD ARTWORKS
  ========================================= */

  async function loadArtworks() {

    try {

      setLoading(true);
      setBackendError("");

      const data = await getArtworks();

      setArtworks(
        Array.isArray(data)
          ? data
          : []
      );

    } catch (error) {

      setBackendError(
        error.message ||
        "Unable to connect to the gallery server."
      );

    } finally {

      setLoading(false);

    }
  }


  /* =========================================
     INITIAL LOAD
  ========================================= */

  useEffect(() => {

    loadArtworks();

    async function checkAuthentication() {

      const currentUser =
        await getCurrentUser();

      if (currentUser) {
        setUser(currentUser);
      }

    }

    checkAuthentication();

  }, []);


  /* =========================================
     AUTH HANDLERS
  ========================================= */

  function handleAuthSuccess(authData) {

    if (!authData) return;

    if (authData.access_token) {

      localStorage.setItem(
        "atelier_token",
        authData.access_token
      );

    }

    if (authData.user) {

      localStorage.setItem(
        "atelier_user",
        JSON.stringify(authData.user)
      );

      setUser(authData.user);

    }

    setAuthMode(null);
  }


  function handleLogout() {

    logoutUser();

    setUser(null);

    setAuthMode(null);

  }


  /* =========================================
     ARTIST FILTER
  ========================================= */

  const artists = useMemo(() => {

    const values = artworks
      .map((a) => a.artist)
      .filter(Boolean);

    return [
      "All",
      ...new Set(values)
    ];

  }, [artworks]);


  /* =========================================
     SEARCH + FILTER
  ========================================= */

  const filteredArtworks = useMemo(() => {

    const query =
      search.trim().toLowerCase();

    return artworks.filter((artwork) => {

      const matchesSearch =
        !query ||
        artwork.title
          ?.toLowerCase()
          .includes(query) ||
        artwork.artist
          ?.toLowerCase()
          .includes(query);

      const matchesArtist =
        artistFilter === "All" ||
        artwork.artist === artistFilter;

      return (
        matchesSearch &&
        matchesArtist
      );

    });

  }, [
    artworks,
    search,
    artistFilter
  ]);


  /* =========================================
     NAVIGATION
  ========================================= */

  function navigate(target) {

    setPage(target);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  }


  /* =========================================
     OPEN PURCHASE
  ========================================= */

  function openPurchase(artwork) {

    setSelectedArtwork(artwork);

    setBuyerName(
      user?.name ||
      user?.username ||
      ""
    );

    setBuyerEmail(
      user?.email ||
      ""
    );

    setPurchaseError("");

    setBuyerModal(true);

  }


  /* =========================================
     PURCHASE
  ========================================= */

  async function handlePurchase(event) {

    event.preventDefault();

    if (
      !buyerName.trim() ||
      !buyerEmail.trim()
    ) {

      setPurchaseError(
        "Please enter your name and email."
      );

      return;
    }

    if (!selectedArtwork) return;


    try {

      setPurchaseLoading(true);

      setPurchaseError("");


      /*
       * Keep the existing purchase flow
       * compatible with the current backend.
       *
       * Once the backend JWT purchase flow
       * is implemented, this can be changed
       * to use the authenticated user directly.
       */

      const registeredUser =
        await registerUser(
          buyerName.trim(),
          buyerEmail.trim()
        );


      const createdOrder =
        await createOrder(
          registeredUser.id,
          selectedArtwork.id
        );


      setOrder(createdOrder);

      setBuyerModal(false);

      setSelectedArtwork(null);

      await loadArtworks();

      navigate("success");


    } catch (error) {

      if (
        error.message
          ?.toLowerCase()
          .includes("sold out")
      ) {

        setPurchaseError(
          "This artwork has just been sold. Please choose another piece."
        );

        await loadArtworks();

      } else {

        setPurchaseError(
          error.message ||
          "Something went wrong while creating your order."
        );

      }

    } finally {

      setPurchaseLoading(false);

    }

  }


  /* =========================================
     ORDER TRACKING
  ========================================= */

  async function trackOrder(event) {

    event.preventDefault();

    if (!orderIdInput.trim()) {

      setTrackingError(
        "Enter an order ID."
      );

      return;
    }


    try {

      setTrackingLoading(true);

      setTrackingError("");

      const result =
        await getOrder(
          Number(orderIdInput)
        );

      setOrder(result);

    } catch (error) {

      setOrder(null);

      setTrackingError(
        error.message ||
        "Order not found."
      );

    } finally {

      setTrackingLoading(false);

    }

  }


  /* =========================================
     ADMIN DASHBOARD
  ========================================= */

  async function loadAdminDashboard(event) {

    if (event) {
      event.preventDefault();
    }

    if (!adminKey.trim()) {

      setAdminError(
        "Enter the admin key."
      );

      return;
    }


    try {

      setAdminLoading(true);

      setAdminError("");

      const data =
        await getAdminStats(
          adminKey.trim()
        );

      setAdminData(data);

    } catch (error) {

      setAdminData(null);

      setAdminError(
        error.message ||
        "Unable to load admin dashboard."
      );

    } finally {

      setAdminLoading(false);

    }

  }


  /* =========================================
     MAIN UI
  ========================================= */

  return (

    <div className="app">


      {/* HEADER */}

      <Header
        page={page}
        navigate={navigate}
        user={user}
        setAuthMode={setAuthMode}
        handleLogout={handleLogout}
      />


      {/* BACKEND ERROR */}

      {backendError && (

        <div className="backend-banner">

          <div>

            <strong>
              Gallery server unavailable
            </strong>

            <span>
              {backendError}
            </span>

          </div>

          <button
            onClick={loadArtworks}
          >
            Retry
          </button>

        </div>

      )}


      {/* HOME */}

      {page === "home" && (

        <Home
          artworks={artworks}
          filteredArtworks={filteredArtworks}
          loading={loading}
          search={search}
          setSearch={setSearch}
          artistFilter={artistFilter}
          setArtistFilter={setArtistFilter}
          artists={artists}
          openPurchase={openPurchase}
          setSelectedArtwork={setSelectedArtwork}
          navigate={navigate}
        />

      )}


      {/* COLLECTION */}

      {page === "collection" && (

        <Collection
          filteredArtworks={filteredArtworks}
          loading={loading}
          search={search}
          setSearch={setSearch}
          artistFilter={artistFilter}
          setArtistFilter={setArtistFilter}
          artists={artists}
          openPurchase={openPurchase}
          setSelectedArtwork={setSelectedArtwork}
        />

      )}


      {/* TRACK ORDER */}

      {page === "track" && (

        <TrackOrder
          orderIdInput={orderIdInput}
          setOrderIdInput={setOrderIdInput}
          trackOrder={trackOrder}
          trackingLoading={trackingLoading}
          trackingError={trackingError}
          order={order}
        />

      )}


      {/* ADMIN */}

      {page === "admin" && (

        <Admin
          adminKey={adminKey}
          setAdminKey={setAdminKey}
          loadAdminDashboard={loadAdminDashboard}
          adminLoading={adminLoading}
          adminError={adminError}
          adminData={adminData}
        />

      )}


      {/* SUCCESS */}

      {page === "success" && (

        <Success
          order={order}
          navigate={navigate}
        />

      )}


      {/* FOOTER */}

      <Footer
        navigate={navigate}
      />


      {/* ARTWORK DETAILS MODAL */}

      {selectedArtwork &&
        !buyerModal && (

          <ArtworkModal
            artwork={selectedArtwork}
            close={() =>
              setSelectedArtwork(null)
            }
            openPurchase={openPurchase}
          />

        )}


      {/* EXISTING PURCHASE MODAL */}

      {buyerModal &&
        selectedArtwork && (

          <BuyerModal
            artwork={selectedArtwork}
            name={buyerName}
            email={buyerEmail}
            setName={setBuyerName}
            setEmail={setBuyerEmail}
            submit={handlePurchase}
            loading={purchaseLoading}
            error={purchaseError}
            close={() => {

              if (!purchaseLoading) {
                setBuyerModal(false);
              }

            }}
          />

        )}


      {/* LOGIN / SIGNUP MODAL */}

      {authMode && (

        <Auth
          mode={authMode}

          onClose={() =>
            setAuthMode(null)
          }

          onSuccess={handleAuthSuccess}

          onSwitchMode={() =>
            setAuthMode(
              authMode === "login"
                ? "signup"
                : "login"
            )
          }

        />

      )}

    </div>

  );

}


/* =========================================
   HEADER
========================================= */

function Header({
  page,
  navigate,
  user,
  setAuthMode,
  handleLogout
}) {

  return (

    <header className="site-header">


      {/* BRAND */}

      <div
        className="brand"
        onClick={() =>
          navigate("home")
        }
      >

        <div className="brand-mark">
          A
        </div>

        <div>

          <div className="brand-name">
            ATELIER
          </div>

          <div className="brand-subtitle">
            Contemporary Art
          </div>

        </div>

      </div>


      {/* NAVIGATION */}

      <nav className="desktop-nav">

        {[
          ["home", "Home"],
          ["collection", "Collection"],
          ["track", "Track Order"],
          ["admin", "Admin"]
        ].map(
          ([target, label]) => (

            <button
              key={target}
              className={
                page === target
                  ? "active"
                  : ""
              }
              onClick={() =>
                navigate(target)
              }
            >
              {label}
            </button>

          )
        )}

      </nav>


      {/* AUTH / EXPLORE */}

      <div className="header-actions">

        {user ? (

          <>

            <span className="header-user">

              Hi,{" "}

              {user.username ||
                user.name ||
                "User"}

            </span>


            <button
              className="header-logout-btn"
              onClick={handleLogout}
            >
              Logout
            </button>

          </>

        ) : (

          <>

            <button
              className="header-signin-btn"
              onClick={() =>
                setAuthMode("login")
              }
            >
              Sign In
            </button>


            <button
              className="header-collection-btn"
              onClick={() =>
                setAuthMode("signup")
              }
            >
              Create Account
              <span>↗</span>
            </button>

          </>

        )}

      </div>

    </header>

  );

}


/* =========================================
   HOME
========================================= */

function Home({
  artworks,
  filteredArtworks,
  loading,
  search,
  setSearch,
  artistFilter,
  setArtistFilter,
  artists,
  openPurchase,
  setSelectedArtwork,
  navigate
}) {

  const featured = artworks[0];


  return (

    <main>


      {/* HERO */}

      <section className="hero">

        <div className="hero-content">

          <div className="eyebrow">

            <span className="eyebrow-line" />

            DIGITAL ART GALLERY

          </div>


          <h1>

            Art that
            <br />

            <em>
              stays with you.
            </em>

          </h1>


          <p className="hero-description">

            Discover a carefully curated collection
            of contemporary works created by emerging
            and established artists.

          </p>


          <div className="hero-actions">

            <button
              className="primary-btn"
              onClick={() =>
                navigate("collection")
              }
            >
              Explore collection
              <span>→</span>
            </button>


            <button
              className="text-btn"
              onClick={() =>
                navigate("track")
              }
            >
              Track an order
            </button>

          </div>


          <div className="hero-stats">

            <div>

              <strong>
                {artworks.length}
              </strong>

              <span>
                Works
              </span>

            </div>


            <div>

              <strong>

                {
                  new Set(
                    artworks
                      .map(
                        (a) => a.artist
                      )
                      .filter(Boolean)
                  ).size
                }

              </strong>

              <span>
                Artists
              </span>

            </div>


            <div>

              <strong>
                01
              </strong>

              <span>
                Gallery
              </span>

            </div>

          </div>

        </div>


        <div className="hero-art">

          <div className="hero-art-frame">

            {featured?.image_url ? (

              <img
                src={featured.image_url}
                alt={featured.title}
              />

            ) : (

              <ArtworkPlaceholder
                title={featured?.title}
              />

            )}


            {featured && (

              <div className="hero-art-caption">

                <div>

                  <span>
                    Featured work
                  </span>

                  <strong>
                    {featured.title}
                  </strong>

                </div>


                <button
                  onClick={() =>
                    setSelectedArtwork(
                      featured
                    )
                  }
                >
                  View
                </button>

              </div>

            )}

          </div>


          <div className="hero-number">
            01
          </div>

        </div>

      </section>


      {/* MARQUEE */}

      <section className="marquee">

        <div>

          CONTEMPORARY ART
          <span>✦</span>

          ORIGINAL WORKS
          <span>✦</span>

          CURATED COLLECTION
          <span>✦</span>

          CONTEMPORARY ART
          <span>✦</span>

        </div>

      </section>


      {/* COLLECTION PREVIEW */}

      <section className="section collection-preview">

        <SectionHeading
          eyebrow="01 — COLLECTION"
          title="Selected works"
          description="A selection from our current collection."
          action="View all works"
          onAction={() =>
            navigate("collection")
          }
        />


        <ArtworkGrid
          artworks={
            filteredArtworks.slice(0, 4)
          }
          loading={loading}
          openPurchase={openPurchase}
          setSelectedArtwork={
            setSelectedArtwork
          }
        />

      </section>


      {/* MANIFESTO */}

      <section className="manifesto">

        <div className="manifesto-label">
          ABOUT ATELIER
        </div>


        <div className="manifesto-content">

          <h2>

            We believe
            <br />

            <em>
              good art
            </em>

            <br />

            creates a pause.

          </h2>


          <p>

            Atelier is a digital-first gallery
            built around one simple idea:
            making exceptional art easier to
            discover and own.

          </p>


          <button
            className="outline-btn"
            onClick={() =>
              navigate("collection")
            }
          >
            Discover the collection →
          </button>

        </div>

      </section>


      {/* DISCOVER */}

      <section className="section">

        <SectionHeading
          eyebrow="02 — DISCOVER"
          title="Find your piece"
          description="Search the collection by artist or artwork."
        />


        <GalleryFilters
          search={search}
          setSearch={setSearch}
          artistFilter={artistFilter}
          setArtistFilter={setArtistFilter}
          artists={artists}
        />


        <ArtworkGrid
          artworks={
            filteredArtworks.slice(0, 6)
          }
          loading={loading}
          openPurchase={openPurchase}
          setSelectedArtwork={
            setSelectedArtwork
          }
        />

      </section>

    </main>

  );

}


/* =========================================
   COLLECTION
========================================= */

function Collection({
  filteredArtworks,
  loading,
  search,
  setSearch,
  artistFilter,
  setArtistFilter,
  artists,
  openPurchase,
  setSelectedArtwork
}) {

  return (

    <main className="page-main">


      <section className="page-hero">

        <div className="eyebrow">

          <span className="eyebrow-line" />

          THE COLLECTION

        </div>


        <h1>

          Works worth
          <br />

          <em>
            looking twice.
          </em>

        </h1>


        <p>

          Browse original works from our
          curated collection of contemporary artists.

        </p>

      </section>


      <section className="section collection-section">

        <GalleryFilters
          search={search}
          setSearch={setSearch}
          artistFilter={artistFilter}
          setArtistFilter={setArtistFilter}
          artists={artists}
        />


        <div className="result-count">

          {filteredArtworks.length}

          {" "}

          {
            filteredArtworks.length === 1
              ? "work"
              : "works"
          }

          {" "}found

        </div>


        <ArtworkGrid
          artworks={filteredArtworks}
          loading={loading}
          openPurchase={openPurchase}
          setSelectedArtwork={
            setSelectedArtwork
          }
        />

      </section>

    </main>

  );

}


/* =========================================
   ARTWORK GRID
========================================= */

function ArtworkGrid({
  artworks,
  loading,
  openPurchase,
  setSelectedArtwork
}) {

  if (loading) {

    return (

      <div className="loading-grid">

        {[1, 2, 3, 4].map(
          (item) => (

            <div
              className="skeleton-card"
              key={item}
            />

          )
        )}

      </div>

    );

  }


  if (!artworks.length) {

    return (

      <div className="empty-state">

        <div className="empty-icon">
          ○
        </div>

        <h3>
          No works found
        </h3>

        <p>
          Try another search term or artist.
        </p>

      </div>

    );

  }


  return (

    <div className="art-grid">

      {artworks.map(
        (artwork, index) => (

          <ArtworkCard
            key={artwork.id}
            artwork={artwork}
            index={index}
            openPurchase={openPurchase}
            setSelectedArtwork={
              setSelectedArtwork
            }
          />

        )
      )}

    </div>

  );

}


/* =========================================
   ARTWORK CARD
========================================= */

function ArtworkCard({
  artwork,
  index,
  openPurchase,
  setSelectedArtwork
}) {

  const available =
    Number(artwork.stock) > 0;


  return (

    <article
      className={
        `art-card ${
          index % 3 === 1
            ? "offset-card"
            : ""
        }`
      }
    >

      <div
        className="art-image"
        onClick={() =>
          setSelectedArtwork(artwork)
        }
      >

        {artwork.image_url ? (

          <img
            src={artwork.image_url}
            alt={artwork.title}
            loading="lazy"
          />

        ) : (

          <ArtworkPlaceholder
            title={artwork.title}
          />

        )}


        <div className="art-overlay">

          <span>
            View artwork <b>↗</b>
          </span>

        </div>


        <div
          className={
            `availability ${
              available
                ? "available"
                : "sold"
            }`
          }
        >

          {available
            ? "Available"
            : "Sold"}

        </div>

      </div>


      <div className="art-info">

        <div>

          <span className="art-artist">
            {artwork.artist ||
              "Unknown Artist"}
          </span>

          <h3>
            {artwork.title}
          </h3>

        </div>


        <div className="art-price">
          {formatPrice(artwork.price)}
        </div>

      </div>


      <button
        className="card-buy"
        disabled={!available}
        onClick={() =>
          openPurchase(artwork)
        }
      >

        {available
          ? "Acquire artwork"
          : "Currently unavailable"}

        {available && (
          <span>
            →
          </span>
        )}

      </button>

    </article>

  );

}


/* =========================================
   FILTERS
========================================= */

function GalleryFilters({
  search,
  setSearch,
  artistFilter,
  setArtistFilter,
  artists
}) {

  return (

    <div className="filters">


      <div className="search-box">

        <span>
          ⌕
        </span>


        <input
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Search artwork or artist..."
        />


        {search && (

          <button
            onClick={() =>
              setSearch("")
            }
          >
            ×
          </button>

        )}

      </div>


      <div className="artist-filter">

        <span>
          Artist
        </span>


        <select
          value={artistFilter}
          onChange={(event) =>
            setArtistFilter(
              event.target.value
            )
          }
        >

          {artists.map(
            (artist) => (

              <option
                key={artist}
                value={artist}
              >
                {artist}
              </option>

            )
          )}

        </select>

      </div>

    </div>

  );

}


/* =========================================
   SECTION HEADING
========================================= */

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  onAction
}) {

  return (

    <div className="section-heading">

      <div>

        <div className="eyebrow">

          <span className="eyebrow-line" />

          {eyebrow}

        </div>


        <h2>
          {title}
        </h2>


        {description && (

          <p>
            {description}
          </p>

        )}

      </div>


      {action && (

        <button
          className="heading-link"
          onClick={onAction}
        >
          {action} →
        </button>

      )}

    </div>

  );

}


/* =========================================
   ARTWORK MODAL
========================================= */

function ArtworkModal({
  artwork,
  close,
  openPurchase
}) {

  const available =
    Number(artwork.stock) > 0;


  return (

    <div
      className="modal-backdrop"
      onMouseDown={close}
    >

      <div
        className="art-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >

        <button
          className="modal-close"
          onClick={close}
        >
          ×
        </button>


        <div className="modal-image">

          {artwork.image_url ? (

            <img
              src={artwork.image_url}
              alt={artwork.title}
            />

          ) : (

            <ArtworkPlaceholder
              title={artwork.title}
            />

          )}

        </div>


        <div className="modal-details">

          <span className="art-artist">

            {artwork.artist ||
              "Unknown Artist"}

          </span>


          <h2>
            {artwork.title}
          </h2>


          <div className="modal-price">

            {formatPrice(
              artwork.price
            )}

          </div>


          <div className="modal-status">

            <span
              className={
                available
                  ? "dot-green"
                  : "dot-red"
              }
            />

            {available
              ? "Available for acquisition"
              : "Currently sold"}

          </div>


          <p>

            An original work from the
            Atelier collection. Each piece
            is carefully selected for its
            artistic character and visual presence.

          </p>


          <button
            className="primary-btn full-btn"
            disabled={!available}
            onClick={() =>
              openPurchase(artwork)
            }
          >

            {available
              ? "Acquire this artwork"
              : "Artwork unavailable"}

            {available && (
              <span>
                →
              </span>
            )}

          </button>

        </div>

      </div>

    </div>

  );

}


/* =========================================
   BUYER MODAL
========================================= */

function BuyerModal({
  artwork,
  name,
  email,
  setName,
  setEmail,
  submit,
  loading,
  error,
  close
}) {

  return (

    <div
      className="modal-backdrop"
      onMouseDown={close}
    >

      <div
        className="buyer-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >

        <button
          className="modal-close"
          onClick={close}
          disabled={loading}
        >
          ×
        </button>


        <div className="buyer-header">

          <div className="eyebrow">
            ACQUIRE ARTWORK
          </div>


          <h2>

            Make it
            <br />

            <em>
              yours.
            </em>

          </h2>


          <p>
            Enter your details to create your gallery order.
          </p>

        </div>


        <div className="purchase-summary">

          <div>

            <span>
              Artwork
            </span>

            <strong>
              {artwork.title}
            </strong>

          </div>


          <div>

            <span>
              Price
            </span>

            <strong>
              {formatPrice(
                artwork.price
              )}
            </strong>

          </div>

        </div>


        <form onSubmit={submit}>

          <label>

            Full name

            <input
              value={name}
              onChange={(event) =>
                setName(
                  event.target.value
                )
              }
              placeholder="Your name"
              required
            />

          </label>


          <label>

            Email address

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              placeholder="you@example.com"
              required
            />

          </label>


          {error && (

            <div className="form-error">
              {error}
            </div>

          )}


          <button
            className="primary-btn full-btn"
            disabled={loading}
            type="submit"
          >

            {loading
              ? "Creating order..."
              : "Continue with order"}

            {!loading && (
              <span>
                →
              </span>
            )}

          </button>

        </form>


        <small className="secure-note">

          Your information is used only
          to create your gallery order.

        </small>

      </div>

    </div>

  );

}


/* =========================================
   SUCCESS
========================================= */

function Success({
  order,
  navigate
}) {

  return (

    <main className="success-page">

      <div className="success-symbol">
        ✓
      </div>


      <div className="eyebrow">
        ORDER CREATED
      </div>


      <h1>

        Your piece is
        <br />

        <em>
          reserved.
        </em>

      </h1>


      {order && (

        <div className="success-card">

          <div>

            <span>
              Order ID
            </span>

            <strong>
              #{order.id}
            </strong>

          </div>


          <div>

            <span>
              Status
            </span>

            <strong className="pending-text">
              {order.status}
            </strong>

          </div>


          <div>

            <span>
              Total
            </span>

            <strong>
              {formatPrice(
                order.total
              )}
            </strong>

          </div>

        </div>

      )}


      <p>

        Your order has been created
        successfully. Keep your order ID
        to track its status.

      </p>


      <div className="success-actions">

        <button
          className="primary-btn"
          onClick={() =>
            navigate("track")
          }
        >
          Track order →
        </button>


        <button
          className="outline-btn"
          onClick={() =>
            navigate("collection")
          }
        >
          Continue exploring
        </button>

      </div>

    </main>

  );

}


/* =========================================
   TRACK ORDER
========================================= */

function TrackOrder({
  orderIdInput,
  setOrderIdInput,
  trackOrder,
  trackingLoading,
  trackingError,
  order
}) {

  return (

    <main className="page-main">


      <section className="track-hero">

        <div className="eyebrow">

          <span className="eyebrow-line" />

          ORDER TRACKING

        </div>


        <h1>

          Where is your
          <br />

          <em>
            artwork?
          </em>

        </h1>


        <p>

          Enter your order number
          to view its current status.

        </p>

      </section>


      <section className="track-section">

        <form
          className="track-form"
          onSubmit={trackOrder}
        >

          <label>

            Order ID

            <input
              type="number"
              min="1"
              value={orderIdInput}
              onChange={(event) =>
                setOrderIdInput(
                  event.target.value
                )
              }
              placeholder="e.g. 1024"
            />

          </label>


          <button
            className="primary-btn"
            disabled={trackingLoading}
          >

            {trackingLoading
              ? "Searching..."
              : "Track order"}

            {!trackingLoading && (
              <span>
                →
              </span>
            )}

          </button>

        </form>


        {trackingError && (

          <div className="form-error large-error">
            {trackingError}
          </div>

        )}


        {order && (

          <div className="order-result">

            <div className="order-image">

              {order.image_url ? (

                <img
                  src={order.image_url}
                  alt={order.title}
                />

              ) : (

                <ArtworkPlaceholder
                  title={order.title}
                />

              )}

            </div>


            <div className="order-content">

              <span className="eyebrow">

                ORDER #{order.id}

              </span>


              <h2>
                {order.title}
              </h2>


              <div className="order-status">

                <span className="status-ring" />

                <div>

                  <span>
                    Status
                  </span>

                  <strong>
                    {order.status}
                  </strong>

                </div>

              </div>


              <div className="order-total">

                <span>
                  Total
                </span>

                <strong>
                  {formatPrice(
                    order.total
                  )}
                </strong>

              </div>

            </div>

          </div>

        )}

      </section>

    </main>

  );

}


/* =========================================
   ADMIN
========================================= */

function Admin({
  adminKey,
  setAdminKey,
  loadAdminDashboard,
  adminLoading,
  adminError,
  adminData
}) {

  return (

    <main className="page-main admin-page">


      <section className="admin-header">

        <div>

          <div className="eyebrow">

            <span className="eyebrow-line" />

            ADMINISTRATION

          </div>


          <h1>

            Gallery
            <br />

            <em>
              overview.
            </em>

          </h1>

        </div>


        {!adminData && (

          <form
            className="admin-login"
            onSubmit={loadAdminDashboard}
          >

            <label>

              Admin key

              <input
                type="password"
                value={adminKey}
                onChange={(event) =>
                  setAdminKey(
                    event.target.value
                  )
                }
                placeholder="Enter admin key"
              />

            </label>


            <button
              className="primary-btn"
              disabled={adminLoading}
            >

              {adminLoading
                ? "Authenticating..."
                : "Open dashboard"}

              {!adminLoading && (
                <span>
                  →
                </span>
              )}

            </button>


            {adminError && (

              <div className="form-error">
                {adminError}
              </div>

            )}

          </form>

        )}

      </section>


      {adminData && (

        <>

          <section className="admin-stats">

            <AdminStat
              label="Registered users"
              value={
                adminData.users_registered
              }
              icon="◎"
            />


            <AdminStat
              label="Artworks sold"
              value={
                adminData.artworks_sold
              }
              icon="◇"
            />


            <AdminStat
              label="Revenue"
              value={
                formatPrice(
                  adminData.revenue
                )
              }
              icon="₹"
            />

          </section>


          <section className="admin-table-section">

            <div className="admin-table-heading">

              <div>

                <div className="eyebrow">
                  CUSTOMER ACTIVITY
                </div>

                <h2>
                  Orders & customers
                </h2>

              </div>


              <button
                className="outline-btn"
                onClick={() =>
                  loadAdminDashboard()
                }
              >
                Refresh
              </button>

            </div>


            {adminData.table?.length ? (

              <div className="table-wrapper">

                <table>

                  <thead>

                    <tr>

                      <th>
                        Customer
                      </th>

                      <th>
                        Email
                      </th>

                      <th>
                        Artwork
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Total
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {adminData.table.map(
                      (row, index) => (

                        <tr key={index}>

                          <td>

                            <strong>
                              {row.name}
                            </strong>

                          </td>


                          <td>
                            {row.email}
                          </td>


                          <td>
                            {row.title || "—"}
                          </td>


                          <td>

                            <span
                              className={
                                `table-status ${
                                  String(
                                    row.status || ""
                                  ).toLowerCase()
                                }`
                              }
                            >

                              {row.status || "—"}

                            </span>

                          </td>


                          <td>

                            {row.total !== null &&
                            row.total !== undefined

                              ? formatPrice(
                                  row.total
                                )

                              : "—"}

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            ) : (

              <div className="empty-state">

                <h3>
                  No customer activity yet
                </h3>

                <p>
                  Orders and customers will appear here.
                </p>

              </div>

            )}

          </section>

        </>

      )}

    </main>

  );

}


/* =========================================
   ADMIN STAT
========================================= */

function AdminStat({
  label,
  value,
  icon
}) {

  return (

    <div className="admin-stat">

      <div className="stat-icon">
        {icon}
      </div>

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>

  );

}


/* =========================================
   ARTWORK PLACEHOLDER
========================================= */

function ArtworkPlaceholder({
  title
}) {

  return (

    <div className="art-placeholder">

      <div className="placeholder-shape shape-one" />

      <div className="placeholder-shape shape-two" />

      <div className="placeholder-shape shape-three" />

      <span>
        {title || "Untitled"}
      </span>

    </div>

  );

}


/* =========================================
   FOOTER
========================================= */

function Footer({
  navigate
}) {

  return (

    <footer className="footer">

      <div className="footer-top">

        <div>

          <div className="footer-brand">
            ATELIER
          </div>

          <p>
            A contemporary digital gallery
            for original works and emerging voices.
          </p>

        </div>


        <div className="footer-links">

          <button
            onClick={() =>
              navigate("home")
            }
          >
            Home
          </button>


          <button
            onClick={() =>
              navigate("collection")
            }
          >
            Collection
          </button>


          <button
            onClick={() =>
              navigate("track")
            }
          >
            Track Order
          </button>


          <button
            onClick={() =>
              navigate("admin")
            }
          >
            Admin
          </button>

        </div>

      </div>


      <div className="footer-bottom">

        <span>
          © {new Date().getFullYear()} Atelier
        </span>

        <span>
          Contemporary art, digitally curated.
        </span>

      </div>

    </footer>

  );

}


export default App;
