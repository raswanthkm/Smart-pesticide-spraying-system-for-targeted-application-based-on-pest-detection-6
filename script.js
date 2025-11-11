// JS Model v2 — heuristic pest presence + conditional recommendation
document.getElementById('year').textContent = new Date().getFullYear();

const input = document.getElementById('imgInput');
const preview = document.getElementById('previewBox');
const resultPanel = document.getElementById('resultPanel');
const detectBtn = document.getElementById('detectBtn');
const resetBtn = document.getElementById('resetBtn');

// Demo pesticide DB
const PEST_DB = {
  Aphid: {
    pesticide: 'Imidacloprid 17.8% SL',
    notes: 'Avoid flowering; rotate MoA.', icon: '🐛'
  },
  Whitefly: {
    pesticide: 'Spirotetramat 22.9% OD',
    notes: 'Combine with sticky traps.', icon: '🦟'
  },
  Caterpillar: {
    pesticide: 'Emamectin Benzoate 5% SG',
    notes: 'Target early instars.', icon: '🦋'
  }
};

input.addEventListener('change', function(){
  const file = this.files?.[0];
  if(!file){ preview.textContent = 'No image selected'; return; }
  const url = URL.createObjectURL(file);
  preview.innerHTML = `<img src='${url}' alt='preview' />`;
  resultPanel.innerHTML = `<div class="empty muted">Ready. Click “Run Detection”.</div>`;
});

resetBtn.addEventListener('click', ()=>{
  input.value = '';
  preview.textContent = 'No image selected';
  resultPanel.innerHTML = `<div class="empty muted">Results will appear here after detection.</div>`;
});

detectBtn.addEventListener('click', async ()=>{
  const file = input.files?.[0];
  if(!file){ alert('Please upload an image first.'); return; }

  resultPanel.innerHTML = `<div class="empty muted">Analyzing image…</div>`;
  const {pestFound, guess} = await analyzeImagePresence(file);

  if(!pestFound){
    renderNoPest();
  }else{
    const kb = PEST_DB[guess] || PEST_DB.Aphid;
    renderPestFound(guess, kb);
  }
});

// Heuristic presence analysis — edge density + brightness stats
async function analyzeImagePresence(file){
  const img = await createImageBitmap(file);
  const off = document.createElement('canvas');
  const ctx = off.getContext('2d', { willReadFrequently: true });
  // Normalize size for analysis
  const W = 256, H = 256;
  off.width = W; off.height = H;
  ctx.drawImage(img, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);

  // Compute brightness variance and simple edge-ish measure (high-frequency changes)
  let sum=0, sum2=0;
  for(let i=0;i<data.length;i+=4){
    const r=data[i], g=data[i+1], b=data[i+2];
    const y = 0.299*r + 0.587*g + 0.114*b;
    sum += y; sum2 += y*y;
  }
  const N = (data.length/4);
  const mean = sum/N;
  const variance = sum2/N - mean*mean;

  // crude edge density: differences to right pixel
  let diffs=0, count=0;
  for(let y=0;y<H;y++){
    for(let x=0;x<W-1;x++){
      const idx = (y*W + x)*4;
      const idxR = (y*W + x + 1)*4;
      const y1 = 0.299*data[idx]+0.587*data[idx+1]+0.114*data[idx+2];
      const y2 = 0.299*data[idxR]+0.587*data[idxR+1]+0.114*data[idxR+2];
      if(Math.abs(y2 - y1) > 20) diffs++;
      count++;
    }
  }
  const edgeDensity = diffs / count; // 0..1

  // very bright pixel ratio (white patches)
  let bright=0;
  for(let i=0;i<data.length;i+=4){
    if(data[i]>220 && data[i+1]>220 && data[i+2]>220) bright++;
  }
  const brightRatio = bright / N;

  // Decide pest presence (tweak thresholds if needed)
  const pestFound = (edgeDensity > 0.18) || (variance > 1200) || (brightRatio > 0.08);

  // Guess a pest label from crude cues (demo only)
  let guess = 'Aphid';
  if(brightRatio > 0.08) guess = 'Whitefly';
  else if(edgeDensity > 0.26) guess = 'Caterpillar';

  return { pestFound, guess };
}

function renderNoPest(){
  const html = `
    <div class="result">
      <div style="font-size:46px; display:flex; align-items:center; justify-content:center">🌱</div>
      <div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
          <h3 style="margin:0">Pest not found</h3>
          <span class="badge none">No pesticide needed</span>
        </div>
        <p class="muted" style="margin-top:6px">Keep monitoring and follow IPM best practices.</p>
      </div>
    </div>
  `;
  resultPanel.innerHTML = html;
}

function renderPestFound(label, kb){
  const html = `
    <div class="result">
      <div style="font-size:46px; display:flex; align-items:center; justify-content:center">${kb.icon}</div>
      <div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
          <h3 style="margin:0">Pest found: ${label}</h3>
          <span class="badge ok">Recommendation</span>
        </div>
        <div class="kv" style="margin-top:8px">
          <div class="k">Pesticide</div><div class="v">${kb.pesticide}</div>
          <div class="k">Notes</div><div class="v">${kb.notes}</div>
        </div>
        <div style="margin-top:10px" class="muted">
          ⚠️ Always follow product labels and local regulations. Use PPE.
        </div>
      </div>
    </div>
  `;
  resultPanel.innerHTML = html;
}
