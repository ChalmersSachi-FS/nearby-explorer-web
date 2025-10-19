// ===============================
// Nearby Explorer (defensive Mapbox init)
// Paste this file as app.js (replace MAPBOX_ACCESS_TOKEN)
// ===============================

const MAPBOX_ACCESS_TOKEN =
  "pk.eyJ1Ijoic2MxNDgiLCJhIjoiY21neHZhaXk3MDN0cTJxb3I0Z3BmbXZ1biJ9.pmshhqW3wLu6kNl1OzvHpw"; // <-- replace with your token

// DOM refs (these must match your index.html)
const userCoordsEl = document.getElementById("user-coords");
const mapStatusEl = document.getElementById("map-status");
const btnRefresh = document.getElementById("btn-refresh-location");
const btnSearch = document.getElementById("btn-search");
const selectCategory = document.getElementById("select-category");
const placesList = document.getElementById("places-list");
const placesLoading = document.getElementById("places-loading");
const placeDetails = document.getElementById("place-details");
const detailName = document.getElementById("detail-name");
const detailAddress = document.getElementById("detail-address");
const detailDistance = document.getElementById("detail-distance");
const photoThumbs = document.getElementById("photo-thumbs");
const photoInput = document.getElementById("photo-input");
const btnTakePhoto = document.getElementById("btn-take-photo");
const btnShare = document.getElementById("btn-share");
const btnCloseDetails = document.getElementById("btn-close-details");
const placeItemTemplate = document.getElementById("place-item-template");

let map = null;
let mapReady = false;
let userLocation = null;
let markers = [];

/* -------------------------
  Utility helpers
   ------------------------- */
function setMapStatus(msg) {
  if (mapStatusEl) mapStatusEl.textContent = msg;
}
function setPlacesLoading(loading, msg = "") {
  if (placesLoading)
    placesLoading.textContent = loading ? msg || "Loading..." : "Idle";
}
function formatCoords(c) {
  if (!c) return "unknown";
  if (typeof c.latitude !== "number" || typeof c.longitude !== "number")
    return "invalid";
  return `${c.latitude.toFixed(6)}, ${c.longitude.toFixed(6)}`;
}
function haversineDistance(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const A =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  const C = 2 * Math.atan2(Math.sqrt(A), Math.sqrt(1 - A));
  return R * C;
}

/* -------------------------
  Defensive Mapbox init
  Waits for `mapboxgl` to exist (poll up to maxAttempts)
  ------------------------- */
function initMapWhenReady(opts = {}) {
  const maxAttempts = opts.maxAttempts || 40;
  const intervalMs = opts.intervalMs || 150;
  let attempts = 0;

  return new Promise((resolve, reject) => {
    const id = setInterval(() => {
      attempts += 1;

      if (typeof mapboxgl !== "undefined") {
        clearInterval(id);
        try {
          mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
          map = new mapboxgl.Map({
            container: "map",
            style: "mapbox://styles/mapbox/streets-v12",
            center: [0, 20],
            zoom: 2,
          });
          map.on("load", () => {
            mapReady = true;
            setMapStatus("Map ready");
            // If we already have a user location, center
            if (userLocation) centerMapOn(userLocation);
            resolve(map);
          });
        } catch (err) {
          clearInterval(id);
          console.error("Mapbox initialization error", err);
          setMapStatus("Mapbox init error");
          reject(err);
        }
      } else if (attempts >= maxAttempts) {
        clearInterval(id);
        const msg =
          "Mapbox GL failed to load (mapboxgl is undefined). Check network, CDN, or adblock.";
        console.error(msg);
        setMapStatus(msg);
        // place visible hint in page
        const el = document.createElement("div");
        el.style =
          "position:fixed;left:12px;top:12px;padding:10px;background:#fff3f3;border:1px solid #f2a0a0;z-index:9999;";
        el.textContent =
          "Mapbox failed to load — check network or script order (see console).";
        document.body.appendChild(el);
        reject(new Error(msg));
      }
    }, intervalMs);
  });
}

/* -------------------------
  Map helpers
  ------------------------- */
function clearMarkers() {
  (markers || []).forEach((m) => {
    try {
      m.remove();
    } catch (e) {}
  });
  markers = [];
}
function addMarker(place) {
  if (!mapReady || !map) return;
  const el = document.createElement("div");
  el.className = "marker";
  el.style.width = "16px";
  el.style.height = "16px";
  el.style.borderRadius = "50%";
  el.style.background = "#FF5722";
  el.style.border = "2px solid white";
  const marker = new mapboxgl.Marker(el)
    .setLngLat([place.coordinates.longitude, place.coordinates.latitude])
    .setPopup(new mapboxgl.Popup({ offset: 8 }).setText(place.name))
    .addTo(map);
  markers.push(marker);
  return marker;
}
function centerMapOn(coords, zoom = 14) {
  if (!mapReady || !map || !coords) return;
  map.flyTo({ center: [coords.longitude, coords.latitude], zoom });
}

/* -------------------------
  Geolocation
  ------------------------- */
async function requestLocation() {
  setMapStatus("Requesting location...");
  if (!navigator.geolocation) {
    setMapStatus("Geolocation not supported in this browser");
    throw new Error("Geolocation not supported");
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLocation = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        if (userCoordsEl) userCoordsEl.textContent = formatCoords(userLocation);
        setMapStatus("Location acquired");
        if (mapReady) centerMapOn(userLocation);
        resolve(userLocation);
      },
      (err) => {
        setMapStatus("Location error: " + (err.message || err.code));
        reject(err);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 12000 }
    );
  });
}

/* -------------------------
  Mapbox Places (Geocoding) request
  ------------------------- */
async function searchNearbyPlaces(coords, category = "restaurant", limit = 12) {
  if (!coords) throw new Error("No coordinates provided");
  const { latitude, longitude } = coords;
  setPlacesLoading(true, "Searching...");
  const text = encodeURIComponent(category);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${text}.json?proximity=${longitude},${latitude}&types=poi&limit=${limit}&access_token=${MAPBOX_ACCESS_TOKEN}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    setMapStatus(`Places API error ${res.status}`);
    setPlacesLoading(false);
    throw new Error(`Places API error ${res.status}: ${body}`);
  }
  const data = await res.json();
  const places = (data.features || []).map((f) => {
    return {
      id: f.id,
      name: f.text,
      address: f.place_name,
      coordinates: { latitude: f.center[1], longitude: f.center[0] },
      distance: Math.round(
        haversineDistance(coords, {
          latitude: f.center[1],
          longitude: f.center[0],
        })
      ),
    };
  });
  setPlacesLoading(false);
  return places.sort((a, b) => (a.distance || 0) - (b.distance || 0));
}

/* -------------------------
  UI render helpers
  ------------------------- */
function renderPlaces(places) {
  if (!placesList) return;
  placesList.innerHTML = "";
  const tpl = placeItemTemplate;
  places.forEach((p) => {
    const node = tpl.content.cloneNode(true);
    const li = node.querySelector("li");
    li.dataset.placeId = p.id;
    li.querySelector(".place-title").textContent = p.name;
    li.querySelector(".place-sub").textContent = `${
      p.address || ""
    } · ${Math.round((p.distance || 0) / 1000)} km`;
    li.querySelector(".btn-view").addEventListener("click", () =>
      openPlaceDetails(p)
    );
    li.querySelector(".btn-photo").addEventListener("click", () => {
      openPlaceDetails(p);
      triggerPhotoInput();
    });
    placesList.appendChild(li);
  });
  // add markers
  clearMarkers();
  places.forEach(addMarker);
}

/* -------------------------
  Place details / photos
  ------------------------- */
function openPlaceDetails(place) {
  if (!placeDetails) return;
  detailName.textContent = place.name;
  detailAddress.textContent = place.address || "No address";
  detailDistance.textContent = `Distance: ${(place.distance / 1000).toFixed(
    2
  )} km (${place.distance} m)`;
  photoThumbs.innerHTML = "";
  const store = loadStoredPhotos();
  const photos = store[place.id] || [];
  if (photos.length === 0) {
    photoThumbs.innerHTML = `<img src="assets/placeholder.png" alt="no photos" style="width:72px;height:72px;object-fit:cover;border-radius:6px">`;
  } else {
    photos.forEach((p) => {
      const img = document.createElement("img");
      img.src = p.dataUrl;
      img.style =
        "width:72px;height:72px;object-fit:cover;border-radius:6px;margin-right:6px";
      photoThumbs.appendChild(img);
    });
  }
  placeDetails.hidden = false;
  // center map
  centerMapOn(place.coordinates, 15);
  btnShare.disabled = false;
  // set selectedPlace so photo saving knows where to attach
  placeDetails.dataset.selectedId = place.id;
}
function closePlaceDetails() {
  placeDetails.hidden = true;
  placeDetails.dataset.selectedId = "";
}
function triggerPhotoInput() {
  if (photoInput) photoInput.click();
}

/* -------------------------
  Photo storage (localStorage, small-scale)
  ------------------------- */
const PHOTO_KEY = "nearby_photos_v1";
function loadStoredPhotos() {
  try {
    const raw = localStorage.getItem(PHOTO_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}
function saveStoredPhotos(obj) {
  localStorage.setItem(PHOTO_KEY, JSON.stringify(obj));
}
async function savePhotoForPlace(placeId, file) {
  const dataUrl = await fileToDataUrl(file);
  const store = loadStoredPhotos();
  store[placeId] = store[placeId] || [];
  store[placeId].push({ id: Date.now(), name: file.name, dataUrl });
  saveStoredPhotos(store);
}
function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

/* -------------------------
  Sharing
  ------------------------- */
async function shareCurrentPlace() {
  const pid = placeDetails.dataset.selectedId;
  if (!pid) return alert("No place selected");
  const store = loadStoredPhotos();
  const photos = (store[pid] || []).map((p) => p.dataUrl);
  const text = `${detailName.textContent}\n${detailAddress.textContent}`;
  // Web Share with files (level 2)
  if (navigator.canShare && photos.length > 0) {
    try {
      const files = photos.map((dataUrl, i) => {
        const blob = dataURLToBlob(dataUrl);
        return new File([blob], `photo-${i + 1}.jpg`, { type: blob.type });
      });
      if (navigator.canShare({ files })) {
        await navigator.share({ title: detailName.textContent, text, files });
        return;
      }
    } catch (e) {
      console.warn("Share error", e);
    }
  }
  // fallback: open new window with text and download links
  const win = window.open("", "_blank");
  const html = `<h2>${detailName.textContent}</h2><p>${
    detailAddress.textContent
  }</p><p>${photos
    .map(
      (p, i) =>
        `<a download="photo-${i + 1}.jpg" href="${p}">Download Photo ${
          i + 1
        }</a><br/><img src="${p}" style="max-width:280px;margin:8px 0;display:block"/></p>`
    )
    .join("")}</p>`;
  win.document.write(html);
}
function dataURLToBlob(dataurl) {
  const arr = dataurl.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8 = new Uint8Array(n);
  while (n--) u8[n] = bstr.charCodeAt(n);
  return new Blob([u8], { type: mime });
}

/* -------------------------
  Event wiring
  ------------------------- */
btnRefresh?.addEventListener("click", async () => {
  try {
    await requestLocation();
  } catch (e) {
    alert("Location failed: " + (e.message || e));
  }
});
btnSearch?.addEventListener("click", async () => {
  if (!userLocation) {
    try {
      await requestLocation();
    } catch (e) {
      return alert("Need location to search");
    }
  }
  try {
    setPlacesLoading(true, "Searching...");
    const category = selectCategory.value || "restaurant";
    const places = await searchNearbyPlaces(userLocation, category, 18);
    renderPlaces(places);
    setMapStatus(`Found ${places.length} places`);
  } catch (e) {
    alert("Places search failed: " + (e.message || e));
    setMapStatus("Search failed");
  } finally {
    setPlacesLoading(false);
  }
});
btnCloseDetails?.addEventListener("click", closePlaceDetails);
btnTakePhoto?.addEventListener("click", triggerPhotoInput);
photoInput?.addEventListener("change", async (ev) => {
  const files = ev.target.files;
  if (!files || !files.length) return;
  const pid = placeDetails.dataset.selectedId;
  if (!pid) return alert("Select a place first");
  await savePhotoForPlace(pid, files[0]);
  openPlaceDetails({
    id: pid,
    name: detailName.textContent,
    address: detailAddress.textContent,
    coordinates: userLocation,
    distance: 0,
  });
});
btnShare?.addEventListener("click", shareCurrentPlace);

/* -------------------------
  Boot sequence: init map (defensive) then try location
  ------------------------- */
(async function boot() {
  setMapStatus("Loading map library...");
  try {
    await initMapWhenReady({ maxAttempts: 60, intervalMs: 200 });
    // try to get location on load (non-blocking)
    try {
      await requestLocation();
    } catch (e) {
      console.warn("Initial location failed", e);
      setMapStatus("Allow location or click Refresh");
    }
  } catch (err) {
    console.error("Map init failed:", err);
    // leave UI in a usable state: allow location but map won't work
    try {
      await requestLocation().catch(() => {});
    } catch (e) {}
  }
})();
