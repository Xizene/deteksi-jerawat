import { useEffect, useMemo, useRef, useState } from "react";

const TESTIMONIALS = [
  {
    name: "Anggi",
    age: "22 Tahun",
    role: "Mahasiswa",
    quote:
      "GlowCare benar-benar membantu aku mengenali jenis jerawat. Awalnya aku kira cuma jerawat biasa, ternyata hasil deteksinya sangat detail dan akurat!",
  },
  {
    name: "Feni",
    age: "21 Tahun",
    role: "Mahasiswi",
    quote:
      "Aku suka karena tampilannya simpel dan hasil analisanya mudah dimengerti. GlowCare bikin aku lebih percaya diri merawat kulit sendiri.",
  },
  {
    name: "Reza",
    age: "24 Tahun",
    role: "Fresh Graduate",
    quote:
      "Fitur realtime-nya keren banget! Bisa langsung lihat deteksi jerawat di wajah sendiri secara live. Rekomendasinya juga sangat membantu.",
  },
  {
    name: "Diah",
    age: "23 Tahun",
    role: "Mahasiswi",
    quote:
      "Produk yang direkomendasikan sangat terjangkau dan mudah dicari. Cocok banget buat yang lagi belajar skincare dari nol seperti aku.",
  },
];

const FEATURES = [
  {
    icon: "🤖",
    title: "YOLOv11 Deep Learning",
    desc: "Model AI mutakhir yang mampu mendeteksi jenis jerawat dengan akurasi tinggi secara real-time.",
  },
  {
    icon: "📷",
    title: "Deteksi Real-time & Upload",
    desc: "Dua mode deteksi: upload foto atau gunakan kamera langsung untuk analisis instan.",
  },
  {
    icon: "💊",
    title: "Rekomendasi Produk Cerdas",
    desc: "Setiap jenis jerawat mendapat rekomendasi ingredient dan produk yang sesuai secara otomatis.",
  },
  {
    icon: "🔒",
    title: "Privasi Terjaga",
    desc: "Foto diproses di server lokal. Tidak ada data yang dikirim ke pihak ketiga.",
  },
];

const API_BASE = "https://xizene-api-jerawat.hf.space";
const WS_BASE = "wss://xizene-api-jerawat.hf.space/ws";

export default function App() {
  // ─── State ───────────────────────────────────────────────────────────
  const [mode, setMode] = useState("upload");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [detections, setDetections] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [status, setStatus] = useState("idle"); // idle|loading|success|error
  const [errorMessage, setErrorMessage] = useState("");
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  // Contact form
  const [formData, setFormData] = useState({ name: "", email: "", topic: "", message: "" });
  const [formSent, setFormSent] = useState(false);
  const [formSending, setFormSending] = useState(false);

  // ─── Refs ─────────────────────────────────────────────────────────────
  const videoRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  // ─── Computed ─────────────────────────────────────────────────────────
  const previewDetections = useMemo(() => {
    if (!imageSize.width || !imageSize.height) return [];
    return detections.map((item, i) => ({
      ...item,
      id: `${item.class_name}-${i}`,
      left: (item.x1 / imageSize.width) * 100,
      top: (item.y1 / imageSize.height) * 100,
      width: ((item.x2 - item.x1) / imageSize.width) * 100,
      height: ((item.y2 - item.y1) / imageSize.height) * 100,
    }));
  }, [detections, imageSize]);

  // ─── Camera helpers ───────────────────────────────────────────────────
  const stopCamera = () => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const ctx = overlayCanvasRef.current?.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    setIsCameraOn(false);
    setCameraReady(false);
  };

  const startCamera = async () => {
    try {
      setErrorMessage(""); setStatus("loading"); setDetections([]); setRecommendations([]);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const ws = new WebSocket(WS_BASE);
      wsRef.current = ws;
      ws.onopen = () => { setIsCameraOn(true); setStatus("success"); };
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.error) { setErrorMessage(data.error); return; }
        setDetections(data.detections || []);
        setRecommendations(data.recommendations || []);
      };
      ws.onerror = () => { setStatus("error"); setErrorMessage("WebSocket gagal terhubung ke backend."); };
      ws.onclose = () => { wsRef.current = null; };
    } catch (err) {
      setStatus("error");
      setErrorMessage(err.message || "Tidak bisa mengakses kamera.");
      stopCamera();
    }
  };

  // ─── Effects ──────────────────────────────────────────────────────────
  useEffect(() => () => { stopCamera(); if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => { if (mode !== "realtime") stopCamera(); }, [mode]);

  useEffect(() => {
    if (!cameraReady || !isCameraOn) return;
    intervalRef.current = setInterval(() => {
      const video = videoRef.current;
      const canvas = captureCanvasRef.current;
      const ws = wsRef.current;
      if (!video || !canvas || !ws || video.readyState !== 4 || ws.readyState !== WebSocket.OPEN) return;
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      ws.send(JSON.stringify({ image: canvas.toDataURL("image/jpeg", 0.7) }));
    }, 300);
    return () => { clearInterval(intervalRef.current); intervalRef.current = null; };
  }, [cameraReady, isCameraOn]);

  useEffect(() => {
    if (mode !== "realtime") return;
    const video = videoRef.current;
    const overlay = overlayCanvasRef.current;
    if (!video || !overlay) return;
    const w = video.videoWidth || 640, h = video.videoHeight || 480;
    overlay.width = w; overlay.height = h;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    detections.forEach(item => {
      ctx.strokeStyle = "#ec4899"; ctx.lineWidth = 2;
      ctx.strokeRect(item.x1, item.y1, item.x2 - item.x1, item.y2 - item.y1);
      const label = `${item.class_name} ${(item.confidence * 100).toFixed(1)}%`;
      ctx.font = "bold 13px Outfit, sans-serif";
      const tw = ctx.measureText(label).width;
      const ty = item.y1 > 28 ? item.y1 - 10 : item.y1 + 20;
      ctx.fillStyle = "#ec4899";
      ctx.fillRect(item.x1 - 2, ty - 18, tw + 14, 22);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, item.x1 + 5, ty);
    });
  }, [detections, mode]);

  // ─── File handlers ────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setDetections([]); setRecommendations([]); setErrorMessage("");
    if (!file) { setSelectedFile(null); setPreviewUrl(""); return; }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file));
    setDetections([]); setRecommendations([]); setErrorMessage("");
  };

  const handleDetect = async () => {
    if (!selectedFile) { setErrorMessage("Pilih foto wajah terlebih dahulu."); return; }
    setStatus("loading"); setErrorMessage("");
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      const res = await fetch(`${API_BASE}/detect`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal memproses gambar.");
      setDetections(data.detections || []);
      setRecommendations(data.recommendations || []);
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err.message || "Terjadi kesalahan saat deteksi.");
    }
  };

  // ─── Contact form ─────────────────────────────────────────────────────
  const handleFormChange = (e) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
  const handleFormSubmit = (e) => {
    e.preventDefault();
    setFormSending(true);
    setTimeout(() => { setFormSent(true); setFormSending(false); }, 1200);
  };

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div style={{ background: "#0f0f0f", minHeight: "100vh", padding: "24px" }}>
      <div className="page-wrapper">

        {/* ── NAVBAR ─────────────────────────────────────────────── */}
        <nav className="navbar">
          <a href="#home" className="navbar-brand">GlowCare</a>
          <ul className="navbar-nav">
            <li><a href="#home">Home</a></li>
            <li><a href="#detect">Deteksi</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#contact">Contact</a></li>
            <li><a href="#detect" className="navbar-cta">Mulai Deteksi →</a></li>
          </ul>
        </nav>

        {/* ── HERO ───────────────────────────────────────────────── */}
        <section id="home" className="hero">
          <div>
            <div className="hero-badge">AI-Powered Skin Analysis</div>
            <h1 className="hero-title">
              Your Skin,<br />
              <span>Smarter Care</span>
            </h1>
            <p className="hero-subtitle">
              Analisis kondisi jerawat wajahmu secara instan menggunakan kecerdasan buatan YOLOv11.
              Dapatkan hasil deteksi akurat dan rekomendasi produk skincare yang tepat.
            </p>
            <div className="hero-actions">
              <a href="#detect" className="btn btn-primary">🔍 Deteksi Sekarang</a>
              <a href="#about" className="btn btn-outline">Pelajari Lebih Lanjut</a>
            </div>
            <div className="hero-stats">
              <div className="stat-item">
                <span className="stat-value">3</span>
                <span className="stat-label">Jenis Jerawat</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">AI</span>
                <span className="stat-label">YOLOv11 Model</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">10+</span>
                <span className="stat-label">Produk per Jenis</span>
              </div>
            </div>
          </div>
          <div className="hero-image-wrapper">
            <img
              className="hero-img"
              src="https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=80"
              alt="Skincare illustration"
            />
          </div>
        </section>

        {/* ── DETECT SECTION ─────────────────────────────────────── */}
        <section id="detect" className="detect-section">
          <div className="detect-card">
            <div className="detect-header">
              <span className="section-tag">AI Detection</span>
              <h2 className="section-title">Analisis <span>Jerawat</span></h2>
              <p className="detect-desc">
                Pilih mode <strong>Upload Foto</strong> untuk analisis dari gambar, atau <strong>Realtime Kamera</strong>
                untuk mendeteksi jerawat secara langsung via webcam.
              </p>
            </div>

            {/* Mode toggle */}
            <div className="mode-toggle">
              <button id="mode-upload" className={`mode-btn${mode === "upload" ? " active" : ""}`} onClick={() => setMode("upload")}>
                📁 Upload Foto
              </button>
              <button id="mode-realtime" className={`mode-btn${mode === "realtime" ? " active" : ""}`} onClick={() => setMode("realtime")}>
                📷 Realtime Kamera
              </button>
            </div>

            {/* Upload mode */}
            {mode === "upload" && (
              <>
                <div
                  className="upload-zone"
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById("file-input").click()}
                >
                  <input id="file-input" type="file" accept="image/*" onChange={handleFileChange} />
                  <label className="upload-label" htmlFor="file-input">
                    <div className="upload-icon">📷</div>
                    <span>Klik atau seret foto ke sini</span>
                    <span className="upload-hint">Format: JPG, PNG, WEBP — Maks 10MB</span>
                    {selectedFile && (
                      <span style={{ color: "var(--pink-600)", fontWeight: 600 }}>
                        ✓ {selectedFile.name}
                      </span>
                    )}
                  </label>
                </div>
                <button
                  id="btn-detect"
                  className="btn btn-primary"
                  onClick={handleDetect}
                  disabled={status === "loading"}
                  style={{ opacity: status === "loading" ? 0.7 : 1 }}
                >
                  {status === "loading" ? "⏳ Menganalisis..." : "🔍 Deteksi Sekarang"}
                </button>
              </>
            )}

            {/* Realtime mode */}
            {mode === "realtime" && (
              <div className="camera-controls">
                <button id="btn-start-camera" className="btn btn-primary" onClick={startCamera} disabled={isCameraOn}>
                  {isCameraOn ? "✓ Kamera Aktif" : "▶ Mulai Kamera"}
                </button>
                <button id="btn-stop-camera" className="btn btn-danger" onClick={stopCamera}>
                  ■ Stop Kamera
                </button>
              </div>
            )}

            {/* Error */}
            {errorMessage && (
              <p className="error-msg">⚠️ {errorMessage}</p>
            )}

            {/* Loading indicator */}
            {status === "loading" && (
              <div className="status-loading">
                <div className="spinner" /> Sedang menganalisis gambar…
              </div>
            )}

            {/* Results grid */}
            <div className="detect-results">
              {/* Left: preview */}
              <div className="result-panel">
                <div className="result-preview">
                  {mode === "upload" ? (
                    previewUrl ? (
                      <div style={{ position: "relative", width: "100%" }}>
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="preview-img"
                          onLoad={e => setImageSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
                        />
                        <div className="detection-overlay">
                          {previewDetections.map(item => (
                            <div
                              key={item.id}
                              className="detection-box"
                              style={{ left: `${item.left}%`, top: `${item.top}%`, width: `${item.width}%`, height: `${item.height}%` }}
                            >
                              <span className="detection-label">
                                {item.class_name} · {(item.confidence * 100).toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="preview-placeholder">
                        <span className="preview-placeholder-icon">🖼️</span>
                        <span>Preview gambar muncul di sini</span>
                      </div>
                    )
                  ) : (
                    <div className="camera-container">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="camera-video"
                        style={{ display: isCameraOn ? "block" : "none" }}
                        onLoadedMetadata={() => setCameraReady(true)}
                      />
                      <canvas ref={overlayCanvasRef} className="camera-overlay" />
                      <canvas ref={captureCanvasRef} style={{ display: "none" }} />
                      {!isCameraOn && (
                        <div className="preview-placeholder">
                          <span className="preview-placeholder-icon">📷</span>
                          <span>Kamera belum dijalankan</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: detections */}
              <div className="result-panel">
                <div className="result-info-panel">
                  {detections.length > 0 ? (
                    detections.map((item, i) => (
                      <div key={`${item.class_name}-${i}`} className="detection-item">
                        <div className="detection-item-header">
                          <span className="detection-item-name">{item.class_name}</span>
                          <span className="confidence-badge">{(item.confidence * 100).toFixed(1)}%</span>
                        </div>
                        <div className="confidence-bar-wrap">
                          <div className="confidence-bar" style={{ width: `${(item.confidence * 100).toFixed(1)}%` }} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      <span className="empty-state-icon">🔬</span>
                      <span>Belum ada hasil deteksi</span>
                      <span style={{ fontSize: 13, color: "var(--neutral-400)" }}>Upload foto atau nyalakan kamera</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div className="recommendations">
                <span className="section-tag">Hasil Rekomendasi</span>
                <h3 className="section-title" style={{ fontSize: 28, marginBottom: 6 }}>
                  Rekomendasi <span>Produk</span>
                </h3>
                <p style={{ fontSize: 14, color: "var(--neutral-600)", marginBottom: 24 }}>
                  Rekomendasi berdasarkan jenis jerawat terdeteksi — bukan diagnosis medis.
                </p>
                {recommendations.map((rec, i) => (
                  <div key={i} className="rec-card">
                    <h3 className="rec-card-title">
                      Untuk Jerawat <span style={{ textTransform: "capitalize" }}>{rec.acne_type}</span>
                    </h3>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--neutral-600)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                      Kandungan yang cocok
                    </p>
                    <div className="ingredients-wrap">
                      {rec.ingredients.map((ing, j) => (
                        <span key={j} className="ingredient-tag">✓ {ing}</span>
                      ))}
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--neutral-600)", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                      Produk rekomendasi
                    </p>
                    <div className="products-grid">
                      {rec.products.map((p, j) => (
                        <div key={j} className="product-card">
                          <div className="product-name">💊 {p.name}</div>
                          <div className="product-price">{p.price}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── ABOUT SECTION ──────────────────────────────────────── */}
        <section id="about" className="about-section">
          <div className="about-grid">
            <div className="about-image-wrapper">
              <img
                className="about-img"
                src="https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80"
                alt="AI skin analysis technology"
              />
              <div className="about-img-badge">
                <span className="about-img-badge-icon">🏆</span>
                <div className="about-img-badge-text">
                  <strong>YOLOv11</strong>
                  <span>Teknologi terkini</span>
                </div>
              </div>
            </div>

            <div>
              <span className="section-tag">Tentang GlowCare</span>
              <h2 className="section-title">
                Teknologi AI untuk<br /><span>Kulit yang Lebih Sehat</span>
              </h2>
              <p className="section-desc">
                GlowCare adalah platform analisis jerawat berbasis kecerdasan buatan yang dikembangkan
                sebagai penelitian skripsi di bidang <em>Computer Vision</em> dan <em>Deep Learning</em>.
                Menggunakan model YOLOv11 yang dilatih dengan dataset jerawat khusus, GlowCare mampu
                mendeteksi tiga jenis jerawat — <strong>papula</strong>, <strong>pustula</strong>, dan{" "}
                <strong>kistik</strong> — secara real-time maupun dari foto.
              </p>

              <div className="feature-list">
                {FEATURES.map((f, i) => (
                  <div key={i} className="feature-item">
                    <div className="feature-icon">{f.icon}</div>
                    <div className="feature-content">
                      <h4>{f.title}</h4>
                      <p>{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 28 }}>
                <p style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--neutral-400)", marginBottom: 12 }}>
                  Dibangun dengan
                </p>
                <div className="tech-stack">
                  {["Python", "FastAPI", "YOLOv11", "Ultralytics", "React", "Vite", "WebSocket", "Pillow"].map(t => (
                    <span key={t} className="tech-badge">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS ───────────────────────────────────────── */}
        <section className="testimonials-section">
          <div style={{ textAlign: "center", marginBottom: 8 }}>
            <span className="section-tag">Testimoni</span>
            <h2 className="section-title">
              Apa Kata <span>Pengguna Kami</span>
            </h2>
            <p className="section-desc" style={{ margin: "0 auto" }}>
              Sudah dicoba oleh mahasiswa dan profesional muda. Ini pengalaman mereka.
            </p>
          </div>
          <div className="testimonials-grid">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="testimonial-card">
                <div className="stars">★★★★★</div>
                <p className="testimonial-quote">"{t.quote}"</p>
                <div className="testimonial-author">
                  <div className="testimonial-avatar">{t.name[0]}</div>
                  <div>
                    <div className="testimonial-name">{t.name}, {t.age}</div>
                    <div className="testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CONTACT SECTION ────────────────────────────────────── */}
        <section id="contact" className="contact-section">
          <div style={{ textAlign: "center" }}>
            <span className="section-tag">Hubungi Kami</span>
            <h2 className="section-title">
              Ada Pertanyaan atau <span>Saran?</span>
            </h2>
            <p className="section-desc" style={{ margin: "0 auto" }}>
              Kami terbuka untuk pertanyaan seputar penelitian, kolaborasi, atau masukan tentang GlowCare.
            </p>
          </div>

          <div className="contact-grid">
            {/* Info */}
            <div>
              <h3 className="contact-info-title">Informasi Kontak</h3>
              <p className="contact-info-desc">
                GlowCare merupakan proyek penelitian skripsi. Jika kamu tertarik berdiskusi tentang
                teknologi deteksi jerawat berbasis AI, skincare, atau ingin berkolaborasi — jangan ragu
                untuk menghubungi kami!
              </p>
              <div className="contact-cards">
                <a href="mailto:glowcare.ai@gmail.com" className="contact-card">
                  <div className="contact-card-icon">📧</div>
                  <div>
                    <div className="contact-card-label">Email</div>
                    <div className="contact-card-value">glowcare.ai@gmail.com</div>
                  </div>
                </a>
                <a href="https://instagram.com/glowcare.ai" target="_blank" rel="noreferrer" className="contact-card">
                  <div className="contact-card-icon">📸</div>
                  <div>
                    <div className="contact-card-label">Instagram</div>
                    <div className="contact-card-value">@glowcare.ai</div>
                  </div>
                </a>
                <div className="contact-card" style={{ cursor: "default" }}>
                  <div className="contact-card-icon">🏫</div>
                  <div>
                    <div className="contact-card-label">Institusi</div>
                    <div className="contact-card-value">Universitas Muhammadiyah Sumatera Utara</div>
                  </div>
                </div>
                <div className="contact-card" style={{ cursor: "default" }}>
                  <div className="contact-card-icon">🕐</div>
                  <div>
                    <div className="contact-card-label">Waktu Respons</div>
                    <div className="contact-card-value">1–2 hari kerja</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="contact-form-card">
              {formSent ? (
                <div className="form-success">
                  <span className="form-success-icon">🎉</span>
                  <strong>Pesan Terkirim!</strong>
                  <span>Terima kasih telah menghubungi kami. Kami akan segera membalas pesanmu.</span>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit}>
                  <h3 className="form-title">Kirim Pesan</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label" htmlFor="contact-name">Nama Lengkap</label>
                      <input
                        id="contact-name"
                        className="form-input"
                        name="name"
                        type="text"
                        placeholder="Nama kamu"
                        value={formData.name}
                        onChange={handleFormChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="contact-email">Email</label>
                      <input
                        id="contact-email"
                        className="form-input"
                        name="email"
                        type="email"
                        placeholder="email@kamu.com"
                        value={formData.email}
                        onChange={handleFormChange}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="contact-topic">Topik</label>
                    <select
                      id="contact-topic"
                      className="form-select"
                      name="topic"
                      value={formData.topic}
                      onChange={handleFormChange}
                      required
                    >
                      <option value="">Pilih topik…</option>
                      <option value="pertanyaan">Pertanyaan Umum</option>
                      <option value="bug">Laporkan Bug</option>
                      <option value="kolaborasi">Kolaborasi / Penelitian</option>
                      <option value="saran">Saran & Masukan</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="contact-message">Pesan</label>
                    <textarea
                      id="contact-message"
                      className="form-textarea"
                      name="message"
                      placeholder="Tuliskan pesanmu di sini…"
                      value={formData.message}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                  <div className="form-submit-wrap">
                    <button
                      id="btn-send-message"
                      type="submit"
                      className="btn btn-primary"
                      disabled={formSending}
                    >
                      {formSending ? "⏳ Mengirim…" : "✉️ Kirim Pesan"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* ── FOOTER ─────────────────────────────────────────────── */}
        <footer className="footer">
          <div className="footer-top">
            <div>
              <div className="footer-brand">GlowCare</div>
              <p className="footer-brand-desc">
                Platform analisis jerawat berbasis AI yang membantu kamu mengenali jenis jerawat
                dan menemukan produk skincare yang tepat — cepat, akurat, dan gratis.
              </p>
            </div>
            <div>
              <div className="footer-col-title">Navigasi</div>
              <ul className="footer-links">
                <li><a href="#home">Home</a></li>
                <li><a href="#detect">Deteksi Jerawat</a></li>
                <li><a href="#about">Tentang GlowCare</a></li>
                <li><a href="#contact">Kontak</a></li>
              </ul>
            </div>
            <div>
              <div className="footer-col-title">Teknologi</div>
              <ul className="footer-links">
                <li><a href="https://docs.ultralytics.com" target="_blank" rel="noreferrer">Ultralytics YOLO</a></li>
                <li><a href="https://fastapi.tiangolo.com" target="_blank" rel="noreferrer">FastAPI</a></li>
                <li><a href="https://react.dev" target="_blank" rel="noreferrer">React</a></li>
                <li><a href="https://vitejs.dev" target="_blank" rel="noreferrer">Vite</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-divider" />
          <div className="footer-bottom">
            <p className="footer-copy">
              © 2025 <span>GlowCare</span>. Dibuat dengan ❤️ untuk Skripsi S1.
            </p>
            <p style={{ fontSize: 13, color: "var(--neutral-600)" }}>
              Bukan pengganti diagnosis medis profesional.
            </p>
          </div>
        </footer>

      </div>
    </div>
  );
}