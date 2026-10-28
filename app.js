/**
 * E-PraSPP Desa Tanjung Manis - Application Engine
 * Lengkap dengan Profil Pejabat, Klausul Perlindungan, & Kuitansi Serah Terima Kas
 * Kabupaten Kutai Timur, Kalimantan Timur
 */

// Global State
let submissions = [];
let activeSettings = {
  village: 'Tanjung Manis',
  district: 'Sangkulirang',
  regency: 'Kutai Timur',
  address: 'Jl. Poros Desa Tanjung Manis, Kode Pos 75684',
  kadesName: 'Kades Tanjung Manis',
  sekdesName: 'Sekdes Tanjung Manis',
  operatorName: 'Operator Siskeudes',
  kaurKeuanganName: 'Kaur Keuangan',
  pkaPem: 'Kasi Pemerintahan',
  pkaKesra: 'Kasi Kesejahteraan',
  pkaPelayanan: 'Kasi Pelayanan',
  pkaUmum: 'Kaur Umum & Perencanaan',
  disclaimerOption: 'PROTECT_PKA',
  firebaseUrl: 'https://epraspp-tanjungmanis-default-rtdb.asia-southeast1.firebasedatabase.app'
};

// Initial Samples
const sampleInitialData = [
  {
    id: 'sub-' + Date.now(),
    regNo: '001/PRA-SPP/TM/X/2026',
    date: new Date().toISOString().split('T')[0],
    pkaRole: 'Kasi Kesejahteraan',
    pkaName: 'Pelaksana Kesejahteraan',
    fundStage: 'ADD (Alokasi Dana Desa) - Tahap 2',
    activities: [
      {
        name: 'Pembangunan Pos Kamling RT 01 Dusun Manis',
        amount: 15000000
      },
      {
        name: 'Pemeliharaan Saluran Drainase Lingkungan RT 02',
        amount: 10000000
      }
    ],
    total: 25000000,
    status: 'SPP_TERBIT',
    disbursement: null // Will store receipt details when money is disbursed
  },
  {
    id: 'sub-' + (Date.now() - 10000),
    regNo: '002/PRA-SPP/TM/X/2026',
    date: new Date().toISOString().split('T')[0],
    pkaRole: 'Kaur Umum & Perencanaan',
    pkaName: 'Pelaksana Umum & Perencanaan',
    fundStage: 'ADD (Alokasi Dana Desa) - Tahap 2',
    activities: [
      {
        name: 'Pembelanjaan ATK dan Kebutuhan Kantor Desa',
        amount: 7500000
      },
      {
        name: 'Pemeliharaan Gedung Kantor Desa',
        amount: 5000000
      }
    ],
    total: 12500000,
    status: 'DANA_CAIR',
    disbursement: {
      receiptNo: 'KW-001/KAS/TM/X/2026',
      receiverType: 'PKA',
      receiverName: 'Pelaksana Umum & Perencanaan',
      receiverRole: 'Kaur Umum & Perencanaan',
      date: new Date().toISOString().split('T')[0],
      amount: 12500000
    }
  }
];

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadSubmissionsFromLocal();
  initDefaultDate();
  initActivityRows();
  initCloudSync();
  registerServiceWorker();
  renderAllViews();
});

function initDefaultDate() {
  const dateInput = document.getElementById('subDate');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
  const disburseDate = document.getElementById('disburseDate');
  if (disburseDate && !disburseDate.value) {
    disburseDate.value = new Date().toISOString().split('T')[0];
  }
}

// PWA Service Worker Registration
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(() => console.log('Service Worker Registered'))
      .catch((err) => console.log('SW registration failed:', err));
  }
}

// ============================================================================
// CLOUD DATABASE SYNC ENGINE (ONLINE CLOUD)
// ============================================================================
let firebaseApp = null;
let firebaseDb = null;

function initCloudSync() {
  const badge = document.getElementById('cloudStatusBadge');
  const badgeText = document.getElementById('cloudStatusText');

  const firebaseUrl = activeSettings.firebaseUrl || 'https://epraspp-tanjungmanis-default-rtdb.asia-southeast1.firebasedatabase.app';

  try {
    if (!firebase.apps.length) {
      firebaseApp = firebase.initializeApp({
        databaseURL: firebaseUrl
      });
    } else {
      firebaseApp = firebase.app();
    }
    firebaseDb = firebase.database();

    // Listen to real-time changes from cloud
    const ref = firebaseDb.ref('tanjung_manis/submissions_v5');
    ref.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data) {
        submissions = Object.values(data);
        saveSubmissionsToLocalOnly();
        renderAllViews();
        updateCloudStatus(true, 'Cloud Terhubung');
      } else if (submissions && submissions.length > 0) {
        // Jika di cloud masih kosong tapi di lokal sudah ada data, unggah data awal ke cloud
        syncToCloud(submissions);
        updateCloudStatus(true, 'Cloud Terhubung');
      }
    }, (error) => {
      console.warn('Firebase notice:', error.message);
      updateCloudStatus(false, 'Periksa Rules Database');
    });

    // Sinkronisasi Pengaturan Profil & Pejabat Desa
    const settingsRef = firebaseDb.ref('tanjung_manis/settings_v5');
    settingsRef.on('value', (snapshot) => {
      const cloudSettings = snapshot.val();
      if (cloudSettings) {
        activeSettings = Object.assign({}, defaultVillageSettings, cloudSettings);
        localStorage.setItem('epraspp_settings_v3_tm', JSON.stringify(activeSettings));
        loadSettings();
        applyVillageBrandToUI();
      }
    });

  } catch (err) {
    console.warn('Cloud sync init error:', err);
    updateCloudStatus(false, 'Offline Lokal');
  }

  // Network state
  window.addEventListener('online', () => updateCloudStatus(true, 'Online Cloud'));
  window.addEventListener('offline', () => updateCloudStatus(false, 'Offline Lokal'));
}

function updateCloudStatus(isOnline, text) {
  const badge = document.getElementById('cloudStatusBadge');
  const badgeText = document.getElementById('cloudStatusText');
  if (!badge) return;

  if (isOnline) {
    badge.className = 'cloud-status-badge online';
    badgeText.textContent = text || 'Online Cloud';
  } else {
    badge.className = 'cloud-status-badge offline';
    badgeText.textContent = text || 'Offline';
  }
}

function syncToCloud(dataList) {
  saveSubmissionsToLocalOnly();
  if (firebaseDb) {
    try {
      const ref = firebaseDb.ref('tanjung_manis/submissions_v5');
      const payload = {};
      dataList.forEach(item => {
        payload[item.id] = item;
      });
      ref.set(payload).catch(e => console.warn('Cloud save deferred:', e));
    } catch (e) {
      console.warn('Cloud save exception:', e);
    }
  }
}

// Local Storage Handlers
function loadSubmissionsFromLocal() {
  const stored = localStorage.getItem('epraspp_submissions_v5_tm');
  if (stored) {
    try {
      submissions = JSON.parse(stored);
    } catch (e) {
      submissions = sampleInitialData;
    }
  } else {
    submissions = sampleInitialData;
    saveSubmissionsToLocalOnly();
  }
}

function saveSubmissionsToLocalOnly() {
  localStorage.setItem('epraspp_submissions_v5_tm', JSON.stringify(submissions));
}

// ============================================================================
// SETTINGS & PROFILE MANAGEMENT
// ============================================================================
function loadSettings() {
  const stored = localStorage.getItem('epraspp_settings_v3_tm');
  if (stored) {
    try {
      activeSettings = { ...activeSettings, ...JSON.parse(stored) };
    } catch (e) {}
  }

  // Update UI Inputs
  if (document.getElementById('cfgVillage')) document.getElementById('cfgVillage').value = activeSettings.village;
  if (document.getElementById('cfgDistrict')) document.getElementById('cfgDistrict').value = activeSettings.district;
  if (document.getElementById('cfgRegency')) document.getElementById('cfgRegency').value = activeSettings.regency;
  if (document.getElementById('cfgAddress')) document.getElementById('cfgAddress').value = activeSettings.address || '';
  if (document.getElementById('cfgKadesName')) document.getElementById('cfgKadesName').value = activeSettings.kadesName;
  if (document.getElementById('cfgSekdesName')) document.getElementById('cfgSekdesName').value = activeSettings.sekdesName;
  if (document.getElementById('cfgOperatorName')) document.getElementById('cfgOperatorName').value = activeSettings.operatorName;
  if (document.getElementById('cfgKaurKeuanganName')) document.getElementById('cfgKaurKeuanganName').value = activeSettings.kaurKeuanganName;
  if (document.getElementById('cfgPkaPem')) document.getElementById('cfgPkaPem').value = activeSettings.pkaPem || 'Kasi Pemerintahan';
  if (document.getElementById('cfgPkaKesra')) document.getElementById('cfgPkaKesra').value = activeSettings.pkaKesra || 'Kasi Kesejahteraan';
  if (document.getElementById('cfgPkaPelayanan')) document.getElementById('cfgPkaPelayanan').value = activeSettings.pkaPelayanan || 'Kasi Pelayanan';
  if (document.getElementById('cfgPkaUmum')) document.getElementById('cfgPkaUmum').value = activeSettings.pkaUmum || 'Kaur Umum & Perencanaan';
  if (document.getElementById('cfgFirebaseUrl')) document.getElementById('cfgFirebaseUrl').value = activeSettings.firebaseUrl || '';

  applyVillageBrandToUI();
}

function applyVillageBrandToUI() {
  // App Bar & Sidebar
  const titleEl = document.getElementById('headerVillageTitle');
  const subEl = document.getElementById('headerVillageSubtitle');
  if (titleEl) titleEl.textContent = `E-PraSPP`;
  if (subEl) subEl.textContent = `Desa ${activeSettings.village} • ${activeSettings.district}`;
  const sidebarVillage = document.getElementById('sidebarVillageText');
  if (sidebarVillage) sidebarVillage.textContent = `Desa ${activeSettings.village}`;

  // Kop Surat Pra-SPP
  if (document.getElementById('kopRegency')) document.getElementById('kopRegency').textContent = `PEMERINTAH KABUPATEN ${activeSettings.regency.toUpperCase()}`;
  if (document.getElementById('kopDistrict')) document.getElementById('kopDistrict').textContent = `KECAMATAN ${activeSettings.district.toUpperCase()}`;
  if (document.getElementById('kopVillage')) document.getElementById('kopVillage').textContent = `PEMERINTAH DESA ${activeSettings.village.toUpperCase()}`;
  if (document.getElementById('kopAddress')) document.getElementById('kopAddress').textContent = activeSettings.address;
  if (document.getElementById('sigKadesRole')) document.getElementById('sigKadesRole').textContent = `Kepala Desa ${activeSettings.village}`;

  // Kop Kuitansi
  if (document.getElementById('rcpRegency')) document.getElementById('rcpRegency').textContent = `PEMERINTAH KABUPATEN ${activeSettings.regency.toUpperCase()}`;
  if (document.getElementById('rcpDistrict')) document.getElementById('rcpDistrict').textContent = `KECAMATAN ${activeSettings.district.toUpperCase()}`;
  if (document.getElementById('rcpVillage')) document.getElementById('rcpVillage').textContent = `PEMERINTAH DESA ${activeSettings.village.toUpperCase()}`;
  if (document.getElementById('rcpAddress')) document.getElementById('rcpAddress').textContent = activeSettings.address;
}

function saveVillageSettings() {
  activeSettings.village = document.getElementById('cfgVillage').value.trim();
  activeSettings.district = document.getElementById('cfgDistrict').value.trim();
  activeSettings.regency = document.getElementById('cfgRegency').value.trim();
  activeSettings.address = document.getElementById('cfgAddress').value.trim();
  activeSettings.kadesName = document.getElementById('cfgKadesName').value.trim();
  activeSettings.sekdesName = document.getElementById('cfgSekdesName').value.trim();
  activeSettings.operatorName = document.getElementById('cfgOperatorName').value.trim();
  activeSettings.kaurKeuanganName = document.getElementById('cfgKaurKeuanganName').value.trim();
  activeSettings.pkaPem = document.getElementById('cfgPkaPem').value.trim();
  activeSettings.pkaKesra = document.getElementById('cfgPkaKesra').value.trim();
  activeSettings.pkaPelayanan = document.getElementById('cfgPkaPelayanan').value.trim();
  activeSettings.pkaUmum = document.getElementById('cfgPkaUmum').value.trim();
  activeSettings.firebaseUrl = document.getElementById('cfgFirebaseUrl').value.trim();

  localStorage.setItem('epraspp_settings_v3_tm', JSON.stringify(activeSettings));
  applyVillageBrandToUI();

  if (firebaseDb) {
    try {
      firebaseDb.ref('tanjung_manis/settings_v5').set(activeSettings).catch(e => console.warn('Cloud settings deferred:', e));
    } catch (e) {}
  }

  showToast('Profil Desa & Daftar Pejabat berhasil disimpan!');
}

function getPkaNameByRole(role) {
  switch (role) {
    case 'Kasi Pemerintahan': return activeSettings.pkaPem || 'Kasi Pemerintahan';
    case 'Kasi Kesejahteraan': return activeSettings.pkaKesra || 'Kasi Kesejahteraan';
    case 'Kasi Pelayanan': return activeSettings.pkaPelayanan || 'Kasi Pelayanan';
    case 'Kaur Umum & Perencanaan': return activeSettings.pkaUmum || 'Kaur Umum & Perencanaan';
    default: return '';
  }
}

function handlePkaChange() {
  const roleSelect = document.getElementById('pkaRole');
  const nameInput = document.getElementById('pkaName');
  const role = roleSelect.value;
  if (role) {
    nameInput.value = getPkaNameByRole(role);
  }
}

// ============================================================================
// DYNAMIC ACTIVITY ROWS (JUDUL BESAR & PAGU DANA PER-PKA)
// ============================================================================
function initActivityRows() {
  const container = document.getElementById('activitiesContainer');
  if (!container) return;
  container.innerHTML = '';
  addActivityRow('Pembangunan Pos Kamling RT 01', 0);
  addActivityRow('Pemeliharaan Saluran Air Bersih', 0);
}

function addActivityRow(name = '', amount = 0) {
  const container = document.getElementById('activitiesContainer');
  const rowId = 'act-row-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  
  const div = document.createElement('div');
  div.className = 'activity-input-card';
  div.id = rowId;
  div.innerHTML = `
    <div class="activity-card-body">
      <div class="form-group" style="margin-bottom: 8px;">
        <label><i class="fa-solid fa-file-lines"></i> Nama / Judul Kegiatan yang Akan Dilaksanakan:</label>
        <input type="text" class="act-name" placeholder="Contoh: Pembangunan Pos Kamling / Pembelanjaan ATK / Siltap Kades" value="${escapeHtml(name)}" required>
      </div>
      <div class="form-row" style="align-items: flex-end;">
        <div class="form-group flex-1" style="margin-bottom: 0;">
          <label><i class="fa-solid fa-money-bill-wave"></i> Jumlah Pagu Anggaran (Rp):</label>
          <input type="number" class="act-amount" min="0" step="any" placeholder="0" value="${amount > 0 ? amount : ''}" required oninput="calculateFormTotal()">
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <button type="button" class="btn-remove-row" title="Hapus Kegiatan" onclick="removeActivityRow('${rowId}')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    </div>
  `;
  container.appendChild(div);
  calculateFormTotal();
}

function removeActivityRow(rowId) {
  const container = document.getElementById('activitiesContainer');
  const row = document.getElementById(rowId);
  if (container.children.length <= 1) {
    showToast('Minimal harus ada 1 kegiatan dalam daftar pengajuan!');
    return;
  }
  if (row) {
    row.remove();
    calculateFormTotal();
  }
}

function calculateFormTotal() {
  const rows = document.querySelectorAll('.activity-input-card');
  let grandTotal = 0;

  rows.forEach(card => {
    const amount = parseFloat(card.querySelector('.act-amount')?.value) || 0;
    grandTotal += amount;
  });

  const display = document.getElementById('formTotalDisplay');
  const terbilangEl = document.getElementById('formTerbilangDisplay');
  
  if (display) display.textContent = formatRupiah(grandTotal);
  if (terbilangEl) terbilangEl.innerHTML = `<em>${terbilang(grandTotal)} Rupiah</em>`;

  return grandTotal;
}

// ============================================================================
// SAVE SUBMISSION & GENERATE OFFICIAL PDF SHEET
// ============================================================================
let currentPreviewSubmission = null;

function saveAndPreviewSubmission() {
  const pkaRole = document.getElementById('pkaRole').value;
  const pkaName = document.getElementById('pkaName').value.trim();
  const fundStage = document.getElementById('fundStage').value;
  const subDate = document.getElementById('subDate').value || new Date().toISOString().split('T')[0];

  if (!pkaRole) {
    showToast('Mohon pilih jabatan Pelaksana Kegiatan (PKA) Anda!');
    return;
  }
  if (!pkaName) {
    showToast('Mohon masukkan nama pejabat PKA!');
    return;
  }

  // Collect Activities
  const activities = [];
  const rows = document.querySelectorAll('.activity-input-card');
  let totalAmount = 0;

  rows.forEach(card => {
    const name = card.querySelector('.act-name')?.value.trim();
    const amount = parseFloat(card.querySelector('.act-amount')?.value) || 0;

    if (name && amount > 0) {
      activities.push({ name, amount });
      totalAmount += amount;
    }
  });

  if (activities.length === 0 || totalAmount <= 0) {
    showToast('Mohon masukkan minimal 1 kegiatan beserta jumlah nominal pagunya!');
    return;
  }

  // Generate Document Registration Number
  const docSeq = String(submissions.length + 1).padStart(3, '0');
  const romanMonth = getRomanMonth(new Date(subDate).getMonth() + 1);
  const currentYear = new Date(subDate).getFullYear();
  const regNo = `${docSeq}/PRA-SPP/TM/${romanMonth}/${currentYear}`;

  const newSubmission = {
    id: 'sub-' + Date.now(),
    regNo: regNo,
    date: subDate,
    pkaRole: pkaRole,
    pkaName: pkaName,
    fundStage: fundStage,
    activities: activities,
    total: totalAmount,
    status: 'DICETAK',
    disbursement: null
  };

  submissions.unshift(newSubmission);
  syncToCloud(submissions);

  showToast(`Pengajuan ${pkaRole} berhasil disimpan ke server online!`);
  renderAllViews();
  openPrintModal(newSubmission);
}

// ============================================================================
// PRINT MODAL & OFFICIAL LETTER SHEET (PRA-SPP)
// ============================================================================
function openPrintModal(item) {
  currentPreviewSubmission = item;
  const modal = document.getElementById('printModal');
  if (!modal) return;

  applyVillageBrandToUI();

  // Fill Header & Meta
  document.getElementById('docRegNumber').textContent = `Nomor: ${item.regNo}`;
  document.getElementById('docPkaRole').textContent = item.pkaRole;
  document.getElementById('docPkaName').textContent = item.pkaName;
  document.getElementById('docFundStage').textContent = item.fundStage;
  document.getElementById('docDate').textContent = formatIndonesianDate(item.date);

  // Fill Activities Table
  const tbody = document.getElementById('docItemsTableBody');
  tbody.innerHTML = '';

  item.activities.forEach((act, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align: center;">${idx + 1}</td>
      <td><strong>${escapeHtml(act.name)}</strong></td>
      <td style="text-align: right; font-weight: 700;">${formatRupiah(act.amount)}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('docTotalAmount').textContent = formatRupiah(item.total);
  document.getElementById('docTerbilangText').textContent = terbilang(item.total) + ' Rupiah';

  // Fill Signatures (Exact Submitting PKA)
  document.getElementById('sigPkaRole').textContent = item.pkaRole;
  document.getElementById('sigPkaName').textContent = `( ${item.pkaName} )`;
  document.getElementById('sigSekdesName').textContent = `( ${activeSettings.sekdesName} )`;
  document.getElementById('sigKadesName').textContent = `( ${activeSettings.kadesName} )`;
  document.getElementById('sigOperatorName').textContent = `( ${activeSettings.operatorName} )`;

  modal.classList.add('open');
}

function closePrintModal() {
  const modal = document.getElementById('printModal');
  if (modal) modal.classList.remove('open');
  currentPreviewSubmission = null;
}

// ============================================================================
// FUNGSI CETAK PRESISI (ANTI-TERPOTONG & ANTI-GESER)
// ============================================================================
function printClean(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.scrollTop = 0;
  }
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  // Jeda 100ms agar browser menuntaskan scroll ke posisi paling atas
  setTimeout(() => {
    window.print();
  }, 100);
}

// Perlindungan jika pengguna menggunakan shortcut keyboard Ctrl + P
window.addEventListener('beforeprint', () => {
  const openModal = document.querySelector('.print-modal-backdrop.open');
  if (openModal) {
    openModal.scrollTop = 0;
  }
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
});

// ============================================================================
// KUITANSI SERAH TERIMA UANG KAS & FOTO DOKUMENTASI
// ============================================================================
let activeDisburseItem = null;
let currentSelectedPhotoData = null;

function handlePhotoSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const MAX_WIDTH = 800;
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      currentSelectedPhotoData = canvas.toDataURL('image/jpeg', 0.75);

      const previewBox = document.getElementById('photoPreviewContainer');
      const previewImg = document.getElementById('photoPreviewImg');
      const btnRemove = document.getElementById('btnRemovePhoto');
      if (previewBox && previewImg) {
        previewImg.src = currentSelectedPhotoData;
        previewBox.style.display = 'flex';
      }
      if (btnRemove) btnRemove.style.display = 'inline-flex';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removeSelectedPhoto() {
  currentSelectedPhotoData = null;
  const input = document.getElementById('disbursePhotoInput');
  if (input) input.value = '';
  const previewBox = document.getElementById('photoPreviewContainer');
  if (previewBox) previewBox.style.display = 'none';
  const btnRemove = document.getElementById('btnRemovePhoto');
  if (btnRemove) btnRemove.style.display = 'none';
}

function openDisburseModalById(id) {
  const item = submissions.find(s => s.id === id);
  if (!item) return;

  activeDisburseItem = item;
  const modal = document.getElementById('disburseSetupModal');
  document.getElementById('disburseSubId').value = item.id;
  document.getElementById('disburseAmount').value = item.total;
  document.getElementById('disburseDate').value = new Date().toISOString().split('T')[0];

  // Default to PKA
  const typeSelect = document.getElementById('disburseReceiverType');
  typeSelect.value = 'PKA';
  handleReceiverTypeChange();

  // If item already has photo
  if (item.disbursement && item.disbursement.photo) {
    currentSelectedPhotoData = item.disbursement.photo;
    document.getElementById('photoPreviewImg').src = currentSelectedPhotoData;
    document.getElementById('photoPreviewContainer').style.display = 'flex';
    document.getElementById('btnRemovePhoto').style.display = 'inline-flex';
  } else {
    removeSelectedPhoto();
  }

  modal.classList.add('open');
}

function handleReceiverTypeChange() {
  if (!activeDisburseItem) return;
  const type = document.getElementById('disburseReceiverType').value;
  const nameInput = document.getElementById('disburseReceiverName');
  const roleInput = document.getElementById('disburseReceiverRole');

  if (type === 'PKA') {
    nameInput.value = activeDisburseItem.pkaName;
    roleInput.value = activeDisburseItem.pkaRole;
  } else if (type === 'KADES') {
    nameInput.value = activeSettings.kadesName;
    roleInput.value = `Kepala Desa ${activeSettings.village}`;
  } else {
    nameInput.value = '';
    roleInput.value = 'Ketua Tim Pelaksana Kegiatan (TPK)';
  }
}

function closeDisburseSetupModal() {
  const modal = document.getElementById('disburseSetupModal');
  if (modal) modal.classList.remove('open');
  activeDisburseItem = null;
}

function submitDisburseAndPrint() {
  if (!activeDisburseItem) return;

  const receiverType = document.getElementById('disburseReceiverType').value;
  const receiverName = document.getElementById('disburseReceiverName').value.trim();
  const receiverRole = document.getElementById('disburseReceiverRole').value.trim();
  const disburseDate = document.getElementById('disburseDate').value || new Date().toISOString().split('T')[0];
  const disburseAmount = parseFloat(document.getElementById('disburseAmount').value) || activeDisburseItem.total;

  if (!receiverName || !receiverRole) {
    showToast('Mohon isi nama dan jabatan penerima uang!');
    return;
  }

  // Generate Receipt Number
  const rcpSeq = String(submissions.filter(s => s.disbursement).length + 1).padStart(3, '0');
  const romanMonth = getRomanMonth(new Date(disburseDate).getMonth() + 1);
  const currentYear = new Date(disburseDate).getFullYear();
  const receiptNo = `KW-${rcpSeq}/KAS/TM/${romanMonth}/${currentYear}`;

  // Update item
  activeDisburseItem.status = 'DANA_CAIR';
  activeDisburseItem.disbursement = {
    receiptNo: receiptNo,
    receiverType: receiverType,
    receiverName: receiverName,
    receiverRole: receiverRole,
    date: disburseDate,
    amount: disburseAmount,
    photo: currentSelectedPhotoData
  };

  syncToCloud(submissions);
  renderAllViews();
  closeDisburseSetupModal();

  showToast('Uang kas diserahkan, bukti foto tersimpan & kuitansi siap dicetak!');
  openReceiptPrintModal(activeDisburseItem);
}

let currentReceiptViewingItem = null;

function openReceiptPrintModal(item) {
  if (!item.disbursement) return;
  currentReceiptViewingItem = item;
  const d = item.disbursement;
  applyVillageBrandToUI();

  document.getElementById('rcpRegNo').textContent = `Nomor Kuitansi: ${d.receiptNo}`;
  document.getElementById('rcpKaurName').textContent = activeSettings.kaurKeuanganName;
  document.getElementById('rcpReceiverName').textContent = d.receiverName;
  document.getElementById('rcpReceiverRole').textContent = d.receiverRole;
  document.getElementById('rcpAmountText').textContent = formatRupiah(d.amount);
  document.getElementById('rcpTerbilangText').textContent = terbilang(d.amount) + ' Rupiah';
  document.getElementById('rcpFundStage').textContent = item.fundStage;
  document.getElementById('rcpDate').textContent = formatIndonesianDate(d.date);

  // Fill activities in receipt
  const tbody = document.getElementById('rcpItemsTableBody');
  tbody.innerHTML = '';
  item.activities.forEach((act, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align: center;">${idx + 1}</td>
      <td><strong>${escapeHtml(act.name)}</strong></td>
      <td style="text-align: right; font-weight: 700;">${formatRupiah(act.amount)}</td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById('rcpTotalAmountFoot').textContent = formatRupiah(d.amount);

  // Photo documentation on official receipt
  const photoSection = document.getElementById('rcpPhotoSection');
  const photoDisplay = document.getElementById('rcpPhotoDisplay');
  if (d.photo) {
    photoDisplay.src = d.photo;
    photoSection.style.display = 'block';
  } else {
    photoSection.style.display = 'none';
  }

  // Signatures on receipt
  document.getElementById('sigRcpKaurName').textContent = `( ${activeSettings.kaurKeuanganName} )`;
  document.getElementById('sigRcpReceiverRole').textContent = d.receiverRole;
  document.getElementById('sigRcpReceiverName').textContent = `( ${d.receiverName} )`;
  document.getElementById('sigRcpReceiverMeta').textContent = `Penerima Fisik Uang Kas`;
  document.getElementById('sigRcpSekdesName').textContent = `( ${activeSettings.sekdesName} )`;

  document.getElementById('receiptModal').classList.add('open');
}

function closeReceiptModal() {
  const modal = document.getElementById('receiptModal');
  if (modal) modal.classList.remove('open');
  currentReceiptViewingItem = null;
}

function editReceiptCurrent() {
  if (!currentReceiptViewingItem) return;
  const itemToEdit = currentReceiptViewingItem;
  closeReceiptModal();
  editReceiptById(itemToEdit.id);
}

function deleteReceiptCurrent() {
  if (!currentReceiptViewingItem) return;
  deleteReceiptById(currentReceiptViewingItem.id);
}

function editReceiptById(id) {
  const item = submissions.find(s => s.id === id);
  if (!item || !item.disbursement) return;

  activeDisburseItem = item;
  const d = item.disbursement;
  const modal = document.getElementById('disburseSetupModal');
  document.getElementById('disburseSubId').value = item.id;
  document.getElementById('disburseAmount').value = d.amount || item.total;
  document.getElementById('disburseDate').value = d.date || new Date().toISOString().split('T')[0];

  const typeSelect = document.getElementById('disburseReceiverType');
  typeSelect.value = d.receiverType || 'PKA';
  document.getElementById('disburseReceiverName').value = d.receiverName || '';
  document.getElementById('disburseReceiverRole').value = d.receiverRole || '';

  if (d.photo) {
    currentSelectedPhotoData = d.photo;
    document.getElementById('photoPreviewImg').src = currentSelectedPhotoData;
    document.getElementById('photoPreviewContainer').style.display = 'flex';
    document.getElementById('btnRemovePhoto').style.display = 'inline-flex';
  } else {
    removeSelectedPhoto();
  }

  modal.classList.add('open');
}

function deleteReceiptById(id) {
  const item = submissions.find(s => s.id === id);
  if (!item || !item.disbursement) return;

  if (confirm(`Apakah Anda yakin ingin menghapus / membatalkan Kuitansi ${item.disbursement.receiptNo}?\n\nStatus kegiatan akan dikembalikan ke "Siap Tarik (SPP Terbit)" dan bukti fisik kuitansi akan dibersihkan.`)) {
    item.disbursement = null;
    item.status = 'SPP_TERBIT';
    syncToCloud(submissions);
    renderAllViews();
    closeReceiptModal();
    showToast('Kuitansi serah terima uang berhasil dihapus/dibatalkan!');
  }
}

function viewPhotoEnlarged(id) {
  const item = submissions.find(s => s.id === id);
  if (!item || !item.disbursement || !item.disbursement.photo) return;
  document.getElementById('enlargedPhotoImg').src = item.disbursement.photo;
  document.getElementById('enlargedPhotoCaption').textContent = 
    `Penyerahan Dana kepada: ${item.disbursement.receiverName} (${item.disbursement.receiverRole}) • Nominal: ${formatRupiah(item.disbursement.amount)}`;
  document.getElementById('viewPhotoModal').classList.add('open');
}

function closeViewPhotoModal() {
  const modal = document.getElementById('viewPhotoModal');
  if (modal) modal.classList.remove('open');
}

// ============================================================================
// BAGIKAN FILE DOKUMEN PDF RESMI LANGSUNG KE WHATSAPP (HP & LAPTOP)
// ============================================================================
async function shareToWhatsApp() {
  if (!currentPreviewSubmission) return;
  const s = currentPreviewSubmission;
  const element = document.getElementById('officialLetterSheet');
  if (!element) return;

  const cleanRegNo = (s.regNo || '001').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanRole = (s.pkaRole || 'PKA').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Surat_PraSPP_${cleanRegNo}_${cleanRole}.pdf`;

  showToast('Memproses file PDF surat pengajuan...');

  const opt = {
    margin: [10, 15, 10, 18],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  const shareText = 
`*SURAT PENGAJUAN PRA-SPP DESA ${activeSettings.village.toUpperCase()}*
------------------------------------------------
*No. Berkas:* ${s.regNo}
*Pelaksana (PKA):* ${s.pkaRole} (${s.pkaName})
*Tahapan / Sumber:* ${s.fundStage}
*Tanggal Pengajuan:* ${formatIndonesianDate(s.date)}
*TOTAL DANA DIAJUKAN:* ${formatRupiah(s.total)}
*Terbilang:* ${terbilang(s.total)} Rupiah

_Catatan:_ Terlampir dokumen resmi Surat Pengajuan Pra-SPP Desa Tanjung Manis. Pelaksana bertanggung jawab atas pelaksanaan teknis kegiatan dan penyelesaian SPJ diselesaikan berdasarkan bukti transaksi riil atas belanja yang disetujui Kepala Desa selaku PKPKD.`;

  try {
    if (typeof html2pdf !== 'undefined') {
      // 1. Render element menjadi file blob PDF
      const pdfBlob = await html2pdf().from(element).set(opt).outputPdf('blob');
      const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

      // 2. Jika di HP Android / browser yang mendukung fitur Web Share File (Direct Attach to WA)
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `Surat Pra-SPP ${s.regNo}`,
          text: shareText
        });
        showToast('Berhasil membagikan file PDF ke WhatsApp!');
        return;
      }

      // 3. Jika di browser laptop yang belum mendukung Web Share File:
      // Otomatis download file PDF ke laptop agar bisa langsung dilampirkan
      await html2pdf().from(element).set(opt).save();
      showToast('File PDF berhasil diunduh ke laptop!');

      setTimeout(() => {
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + '\n\n*File PDF resmi telah diunduh di laptop Anda dengan nama:* ' + filename)}`;
        window.open(waUrl, '_blank');
      }, 700);
      return;
    }
  } catch (err) {
    console.warn('Share file PDF exception:', err);
  }

  // Fallback teks jika library belum siap
  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
  window.open(waUrl, '_blank');
}

async function shareReceiptToWhatsApp() {
  const element = document.getElementById('officialReceiptSheet');
  if (!element || !activeDisburseItem) return;
  const s = activeDisburseItem;

  const rcpNo = (s.receiptNo || 'KW-001').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Kuitansi_Kas_${rcpNo}.pdf`;

  showToast('Memproses file PDF kuitansi kas...');

  const opt = {
    margin: [10, 15, 10, 18],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  const shareText = 
`*KUITANSI SERAH TERIMA UANG KAS DESA ${activeSettings.village.toUpperCase()}*
------------------------------------------------
*No. Kuitansi:* ${s.receiptNo || '-'}
*Telah Diterima Dari:* Kaur Keuangan (${activeSettings.kaurKeuanganName})
*Diserahkan Kepada:* ${s.disbursedTo || '-'}
*Nominal Kas:* ${formatRupiah(s.total)}
*Terbilang:* ${terbilang(s.total)} Rupiah
*Tanggal Penyerahan:* ${formatIndonesianDate(s.disbursedDate)}

_Catatan:_ Fisik uang kas desa telah diserahterimakan secara riil dan penuh. Terlampir file dokumen PDF resmi kuitansi beserta bukti serah terima kas.`;

  try {
    if (typeof html2pdf !== 'undefined') {
      const pdfBlob = await html2pdf().from(element).set(opt).outputPdf('blob');
      const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `Kuitansi Kas ${s.receiptNo}`,
          text: shareText
        });
        showToast('Berhasil membagikan kuitansi PDF ke WhatsApp!');
        return;
      }

      await html2pdf().from(element).set(opt).save();
      showToast('Kuitansi PDF berhasil diunduh ke laptop!');

      setTimeout(() => {
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + '\n\n*File Kuitansi PDF telah diunduh di laptop Anda dengan nama:* ' + filename)}`;
        window.open(waUrl, '_blank');
      }, 700);
      return;
    }
  } catch (err) {
    console.warn('Share receipt PDF exception:', err);
  }

  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
  window.open(waUrl, '_blank');
}

// ============================================================================
// RENDER VIEWS & DASHBOARD
// ============================================================================
function renderAllViews() {
  renderSubmissionsList();
  renderKaurRekap();
}

function renderSubmissionsList() {
  const container = document.getElementById('submissionsList');
  if (!container) return;

  const searchVal = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const filterPka = document.getElementById('pkaFilter')?.value || 'ALL';

  const filtered = submissions.filter(s => {
    const matchSearch = s.fundStage.toLowerCase().includes(searchVal) || 
                        s.pkaRole.toLowerCase().includes(searchVal) ||
                        s.pkaName.toLowerCase().includes(searchVal) ||
                        s.activities.some(a => a.name.toLowerCase().includes(searchVal));
    const matchPka = filterPka === 'ALL' || s.pkaRole === filterPka;
    return matchSearch && matchPka;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-folder-open"></i>
        <p>Tidak ada pengajuan kegiatan yang cocok dengan pencarian.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const badgeInfo = getStatusBadge(item.status);
    const activityNames = item.activities.map(a => `<span class="activity-chip">${a.name} (${formatRupiah(a.amount)})</span>`).join(' ');

    const receiptBtn = item.disbursement ? `
      <button class="btn btn-sm btn-receipt" onclick="openReceiptPrintModalById('${item.id}')" title="Cetak Kuitansi Serah Terima">
        <i class="fa-solid fa-receipt"></i> Kuitansi
      </button>
      <button class="btn btn-sm btn-outline" onclick="editReceiptById('${item.id}')" title="Edit Kuitansi">
        <i class="fa-solid fa-pen-to-square"></i>
      </button>
      <button class="btn btn-sm btn-outline text-danger" onclick="deleteReceiptById('${item.id}')" title="Hapus Kuitansi">
        <i class="fa-solid fa-trash"></i>
      </button>
    ` : `
      <button class="btn btn-sm btn-outline text-success" onclick="openDisburseModalById('${item.id}')" title="Serah Terima Uang & Cetak Kuitansi">
        <i class="fa-solid fa-hand-holding-dollar"></i> Serahkan Kas
      </button>
    `;

    return `
      <div class="submission-item">
        <div class="item-top">
          <span class="item-pka">${item.pkaRole} • ${item.pkaName}</span>
          <span class="badge ${badgeInfo.class}">${badgeInfo.label}</span>
        </div>
        <div class="item-activity">${item.fundStage} (${item.activities.length} Kegiatan)</div>
        <div class="activity-chips-box">
          ${activityNames}
        </div>
        <div class="item-meta">
          <span><i class="fa-solid fa-hashtag"></i> ${item.regNo}</span>
          <span><i class="fa-solid fa-calendar-day"></i> ${formatIndonesianDate(item.date)}</span>
          <span><i class="fa-solid fa-list-check"></i> ${item.activities.length} Kegiatan</span>
          ${item.disbursement ? `<span style="color:#b91c1c; font-weight:700;"><i class="fa-solid fa-user-check"></i> Fisik dipegang: ${item.disbursement.receiverName}</span>` : ''}
        </div>
        <div class="item-bottom">
          <div class="item-nominal">${formatRupiah(item.total)}</div>
          <div class="item-actions">
            ${receiptBtn}
            <button class="btn btn-sm btn-outline" onclick="openPrintModalById('${item.id}')" title="Cetak Surat Pengajuan PDF">
              <i class="fa-solid fa-file-pdf"></i> Surat SPP
            </button>
            <button class="btn btn-sm btn-outline text-danger" onclick="deleteSubmission('${item.id}')" title="Hapus">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterSubmissions() {
  renderSubmissionsList();
}

function openPrintModalById(id) {
  const item = submissions.find(s => s.id === id);
  if (item) openPrintModal(item);
}

function openReceiptPrintModalById(id) {
  const item = submissions.find(s => s.id === id);
  if (item) openReceiptPrintModal(item);
}

function deleteSubmission(id) {
  if (confirm('Apakah Anda yakin ingin menghapus arsip pengajuan ini?')) {
    submissions = submissions.filter(s => s.id !== id);
    syncToCloud(submissions);
    renderAllViews();
    showToast('Pengajuan berhasil dihapus!');
  }
}

// ---------------- KAUR KEUANGAN DASHBOARD ----------------
function renderKaurRekap() {
  const tbody = document.getElementById('rekapTableBody');
  if (!tbody) return;

  let grandTotal = 0;
  let readyTotal = 0;
  let disbursedTotal = 0;

  let readyCount = 0;
  let disbursedCount = 0;

  submissions.forEach(s => {
    grandTotal += s.total;
    if (s.status === 'SPP_TERBIT') {
      readyTotal += s.total;
      readyCount += s.activities.length;
    } else if (s.status === 'DANA_CAIR') {
      disbursedTotal += s.total;
      disbursedCount++;
    }
  });

  // Metrics
  document.getElementById('metricTotalSubmitted').textContent = formatRupiah(grandTotal);
  document.getElementById('metricCountSubmitted').textContent = `${submissions.length} Berkas Pengajuan`;

  document.getElementById('metricTotalReady').textContent = formatRupiah(readyTotal);
  document.getElementById('metricCountReady').textContent = `${readyCount} Kegiatan Siap Tarik`;

  document.getElementById('metricTotalDisbursed').textContent = formatRupiah(disbursedTotal);
  document.getElementById('metricCountDisbursed').textContent = `${disbursedCount} Berkas Diserahterimakan`;

  // Rekap Table Rows
  if (submissions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px;">Belum ada pengajuan kegiatan dari PKA.</td></tr>`;
    return;
  }

  tbody.innerHTML = submissions.map((item, idx) => {
    const badge = getStatusBadge(item.status);
    
    // Physical cash receiver badge
    let receiverBadge = '<span style="color:#9ca3af; font-size:0.75rem;">Belum diserahkan</span>';
    if (item.disbursement) {
      const isKades = item.disbursement.receiverType === 'KADES';
      const bg = isKades ? '#fee2e2' : '#ecfdf5';
      const color = isKades ? '#b91c1c' : '#15803d';
      receiverBadge = `<span class="badge" style="background:${bg}; color:${color}; font-size:0.75rem;">
        <i class="fa-solid fa-user-check"></i> ${item.disbursement.receiverName} (${item.disbursement.receiverRole})
      </span>`;
    }

    // Photo proof cell
    let photoCol = '<span style="color:#9ca3af; font-size:0.75rem;">-</span>';
    if (item.disbursement && item.disbursement.photo) {
      photoCol = `
        <button class="btn btn-sm btn-photo-view" onclick="viewPhotoEnlarged('${item.id}')" title="Lihat Foto Bukti">
          <i class="fa-solid fa-image"></i> Lihat Foto
        </button>
      `;
    }

    return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>${formatIndonesianDate(item.date)}</td>
        <td>
          <strong style="color: var(--primary);">${item.pkaRole}</strong><br>
          <small>${item.pkaName}</small>
        </td>
        <td><small>${item.fundStage}</small></td>
        <td style="font-weight: 800; color: var(--primary-dark);">${formatRupiah(item.total)}</td>
        <td>${receiverBadge}</td>
        <td style="text-align: center;">${photoCol}</td>
        <td><span class="badge ${badge.class}">${badge.label}</span></td>
        <td>
          <div style="display:flex; gap:4px; flex-direction:column;">
            ${item.disbursement ? `
              <div style="display:flex; gap:4px;">
                <button class="btn btn-sm btn-receipt flex-1" onclick="openReceiptPrintModalById('${item.id}')" title="Cetak Kuitansi Penyerahan Kas">
                  <i class="fa-solid fa-receipt"></i> Kuitansi
                </button>
                <button class="btn btn-sm btn-outline" onclick="editReceiptById('${item.id}')" title="Edit Data Kuitansi">
                  <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button class="btn btn-sm btn-outline text-danger" onclick="deleteReceiptById('${item.id}')" title="Hapus/Batalkan Kuitansi Ini">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            ` : `
              <button class="btn btn-sm btn-outline text-success" onclick="openDisburseModalById('${item.id}')" title="Serahkan Uang & Cetak Kuitansi">
                <i class="fa-solid fa-hand-holding-dollar"></i> Serahkan Uang
              </button>
            `}
            <button class="btn btn-sm btn-outline" onclick="openPrintModalById('${item.id}')" title="Lihat Surat Pengajuan">
              <i class="fa-solid fa-file-pdf"></i> Surat SPP
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Cetak Lembar Rekap Penarikan Kas Desa
function printWithdrawalSummary() {
  const approvedItems = submissions.filter(s => s.status === 'SPP_TERBIT' || s.status === 'DICETAK' || s.status === 'DANA_CAIR');
  if (approvedItems.length === 0) {
    alert('Belum ada kegiatan yang siap ditarik di bank!');
    return;
  }

  let totalWithdraw = 0;
  let rowsHtml = '';
  let count = 1;

  approvedItems.forEach(item => {
    item.activities.forEach(act => {
      totalWithdraw += act.amount;
      rowsHtml += `
        <tr>
          <td style="border:1px solid #000; padding:6px; text-align:center;">${count++}</td>
          <td style="border:1px solid #000; padding:6px;"><strong>${act.name}</strong></td>
          <td style="border:1px solid #000; padding:6px; text-align:center;">${item.pkaRole}<br><small>(${item.pkaName})</small></td>
          <td style="border:1px solid #000; padding:6px; text-align:center;">${item.fundStage}</td>
          <td style="border:1px solid #000; padding:6px; text-align:right;">${formatRupiah(act.amount)}</td>
        </tr>
      `;
    });
  });

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Rekap Rencana Penarikan Kas Desa ${activeSettings.village}</title>
      <style>
        body { font-family: 'Times New Roman', serif; padding: 25px; line-height: 1.4; }
        h3, h4 { margin: 2px 0; text-align: center; }
        .separator { border-top: 2px solid #000; margin: 10px 0 20px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10.5pt; }
        th { border: 1px solid #000; background: #eee; padding: 8px; }
        .sig { margin-top: 40px; display: flex; justify-content: space-between; text-align: center; }
      </style>
    </head>
    <body>
      <h3>PEMERINTAH DESA ${activeSettings.village.toUpperCase()}</h3>
      <h4>KECAMATAN ${activeSettings.district.toUpperCase()} - KABUPATEN ${activeSettings.regency.toUpperCase()}</h4>
      <h4>REKAPITULASI RENCANA PENARIKAN DANA KAS DESA (BANK)</h4>
      <div class="separator"></div>
      <p>Tanggal Cetak: ${formatIndonesianDate(new Date().toISOString().split('T')[0])}</p>
      <table>
        <thead>
          <tr>
            <th>No</th>
            <th>Judul Kegiatan yang Akan Dilaksanakan</th>
            <th>Pelaksana (PKA)</th>
            <th>Tahapan / Sumber</th>
            <th>Pagu Anggaran (Rp)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr>
            <th colspan="4" style="text-align:right;">TOTAL DANA YANG AKAN DITARIK DI BANK:</th>
            <th style="text-align:right;">${formatRupiah(totalWithdraw)}</th>
          </tr>
        </tfoot>
      </table>
      <p style="margin-top:10px;"><strong>Terbilang: </strong><em>${terbilang(totalWithdraw)} Rupiah</em></p>
      
      <div class="sig">
        <div style="width: 45%;">
          Mengetahui,<br>Kepala Desa ${activeSettings.village}<br><br><br><br>
          <strong>( ${activeSettings.kadesName} )</strong>
        </div>
        <div style="width: 45%;">
          ${activeSettings.village}, ${formatIndonesianDate(new Date().toISOString().split('T')[0])}<br>
          Kaur Keuangan (Bendahara Desa)<br><br><br><br>
          <strong>( ${activeSettings.kaurKeuanganName} )</strong>
        </div>
      </div>
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ============================================================================
// BACKUP & EXPORT
// ============================================================================
function backupAndExportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(submissions, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `Backup_PengajuanPKA_${activeSettings.village}_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('File backup data berhasil diunduh!');
}

// ============================================================================
// SIDEBAR MENU DRAWER HANDLERS (MENU SAMPING KIRI)
// ============================================================================
function toggleSidebarMenu() {
  const drawer = document.getElementById('sidebarDrawer');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!drawer) return;
  const isOpen = drawer.classList.contains('open');
  if (isOpen) {
    closeSidebarMenu();
  } else {
    drawer.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeSidebarMenu() {
  const drawer = document.getElementById('sidebarDrawer');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (drawer) drawer.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
  document.body.style.overflow = '';
}

function navigateFromSidebar(viewId, clickedBtn) {
  switchView(viewId);
  closeSidebarMenu();
}

// Tutup menu drawer saat tombol ESC ditekan
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSidebarMenu();
  }
});

// ============================================================================
// NAVIGATION & VIEW SWITCHER
// ============================================================================
function switchView(viewId, btnEl) {
  document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn, .d-nav-btn, .sidebar-nav-item').forEach(b => b.classList.remove('active'));

  const targetView = document.getElementById(viewId);
  if (targetView) targetView.classList.add('active');

  // Highlight all corresponding buttons in desktop header and sidebar drawer
  document.querySelectorAll('.nav-btn, .d-nav-btn, .sidebar-nav-item').forEach(b => {
    if (b.getAttribute('onclick')?.includes(viewId)) {
      b.classList.add('active');
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function formatRupiah(number) {
  return 'Rp ' + Number(number || 0).toLocaleString('id-ID');
}

function formatIndonesianDate(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${parseInt(parts[2], 10)} ${months[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
}

function getRomanMonth(monthNum) {
  const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return romans[monthNum - 1] || 'X';
}

function getStatusBadge(status) {
  switch (status) {
    case 'DRAF':
      return { class: 'badge-draft', label: 'Draf' };
    case 'DICETAK':
      return { class: 'badge-printed', label: 'Surat Dicetak' };
    case 'SPP_TERBIT':
      return { class: 'badge-spp', label: 'SPP Terbit (Siap Tarik)' };
    case 'DANA_CAIR':
      return { class: 'badge-done', label: 'Uang Diserahkan' };
    default:
      return { class: 'badge-draft', label: 'Proses' };
  }
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Indonesian Terbilang Algorithm
function terbilang(n) {
  n = Math.floor(Math.abs(n));
  const words = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  
  if (n < 12) return words[n];
  if (n < 20) return terbilang(n - 10) + ' Belas';
  if (n < 100) return terbilang(Math.floor(n / 10)) + ' Puluh ' + words[n % 10];
  if (n < 200) return 'Seratus ' + terbilang(n - 100);
  if (n < 1000) return terbilang(Math.floor(n / 100)) + ' Ratus ' + terbilang(n % 100);
  if (n < 2000) return 'Seribu ' + terbilang(n - 1000);
  if (n < 1000000) return terbilang(Math.floor(n / 1000)) + ' Ribu ' + terbilang(n % 1000);
  if (n < 1000000000) return terbilang(Math.floor(n / 1000000)) + ' Juta ' + terbilang(n % 1000000);
  if (n < 1000000000000) return terbilang(Math.floor(n / 1000000000)) + ' Milyar ' + terbilang(n % 1000000000);
  return '';
}
