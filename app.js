const fileInput = document.getElementById('fileInput');
const processBtn = document.getElementById('processBtn');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const statusText = document.getElementById('statusText');
const progressBar = document.getElementById('progressBar');
const tableBody = document.querySelector('#resultsTable tbody');

const extractedRows = [];

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.worker.min.js';
}


const dateRegex = /(\b\d{2}[\/.-]\d{2}[\/.-]\d{4}\b)/g;
const rgNumberRegex = /\b(?:rg|registro\s+geral|identidade)\D{0,12}([0-9]{1,2}\.?[0-9]{3}\.?[0-9]{3}[\-–]?[0-9xX]?)/i;
const cnhNumberRegex = /\b(?:registro\s*\d{11}|n[ºo°]?\s*registro\D{0,8}\d{11}|\b\d{11}\b)/i;

function setStatus(message, progress = null) {
  statusText.textContent = message;
  if (typeof progress === 'number') {
    progressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  }
}

function normalizeSpaces(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function pickMostLikelyName(text) {
  const lines = text
    .split('\n')
    .map((line) => normalizeSpaces(line))
    .filter(Boolean);

  const excludedWords = [
    'REPÚBLICA',
    'FEDERATIVA',
    'BRASIL',
    'CARTEIRA',
    'NACIONAL',
    'HABILITAÇÃO',
    'IDENTIDADE',
    'REGISTRO',
    'VALIDADE',
    'ASSINATURA',
    'FILIAÇÃO',
    'NASCIMENTO',
    'CPF',
    'CNH',
    'RG',
    'DOCUMENTO',
    'SECRETARIA',
    'DETRAN'
  ];

  const probable = lines
    .filter((line) => /^[A-ZÀ-Ü\s']{8,}$/.test(line.toUpperCase()))
    .filter((line) => !excludedWords.some((word) => line.toUpperCase().includes(word)))
    .sort((a, b) => b.length - a.length);

  return probable[0] || '';
}

function findDates(text) {
  return [...text.matchAll(dateRegex)].map((match) => match[1]);
}

function inferDocumentType(text) {
  const upper = text.toUpperCase();
  if (upper.includes('CARTEIRA NACIONAL DE HABILITAÇÃO') || upper.includes('CNH')) {
    return 'CNH';
  }
  if (upper.includes('IDENTIDADE') || upper.includes('REGISTRO GERAL') || upper.includes('RG')) {
    return 'RG';
  }
  return 'Não identificado';
}

function extractDocumentNumber(text, type) {
  if (type === 'CNH') {
    const cnh = text.match(cnhNumberRegex);
    if (!cnh) return '';
    const raw = cnh[0].match(/\d{11}/);
    return raw ? raw[0] : '';
  }

  if (type === 'RG') {
    const rg = text.match(rgNumberRegex);
    return rg?.[1] || '';
  }

  return '';
}

function buildStructuredData(ocrText, fileName, confidence) {
  const cleanText = ocrText.replace(/[|]/g, 'I');
  const documentType = inferDocumentType(cleanText);
  const dates = findDates(cleanText);

  return {
    arquivo: fileName,
    tipo: documentType,
    nome: pickMostLikelyName(cleanText),
    dataNascimento: dates[0] || '',
    dataEmissao: dates[1] || '',
    validade: dates[2] || '',
    primeiraHabilitacao: dates[3] || '',
    numeroDocumento: extractDocumentNumber(cleanText, documentType),
    confiancaOCR: Number(confidence.toFixed(2))
  };
}

function renderTable() {
  tableBody.innerHTML = '';

  if (!extractedRows.length) {
    const row = document.createElement('tr');
    row.innerHTML = `<td colspan="10" class="empty-cell">Nenhum dado processado ainda.</td>`;
    tableBody.appendChild(row);
    return;
  }

  extractedRows.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${item.arquivo}</td>
      <td>${item.tipo || '-'}</td>
      <td>${item.nome || '-'}</td>
      <td>${item.dataNascimento || '-'}</td>
      <td>${item.dataEmissao || '-'}</td>
      <td>${item.validade || '-'}</td>
      <td>${item.primeiraHabilitacao || '-'}</td>
      <td>${item.numeroDocumento || '-'}</td>
      <td>${item.confiancaOCR}</td>
    `;
    tableBody.appendChild(tr);
  });
}

async function fileToImageSource(file) {
  if (file.type === 'application/pdf') {
    if (!window.pdfjsLib) {
      throw new Error('Biblioteca de PDF não foi carregada.');
    }

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/png');
  }

  return URL.createObjectURL(file);
}

async function processFiles() {
  const files = [...fileInput.files];

  if (!files.length) {
    setStatus('Selecione ao menos um arquivo para processar.', 0);
    return;
  }

  processBtn.disabled = true;
  setStatus('Iniciando OCR...', 2);

  try {
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const pctBase = (i / files.length) * 100;

      setStatus(`Processando ${file.name} (${i + 1}/${files.length})...`, pctBase);

      const imageSource = await fileToImageSource(file);

      const result = await Tesseract.recognize(imageSource, 'por', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const current = pctBase + (m.progress * (100 / files.length));
            setStatus(`OCR: ${file.name} (${Math.round(m.progress * 100)}%)`, current);
          }
        }
      });

      if (imageSource.startsWith('blob:')) {
        URL.revokeObjectURL(imageSource);
      }

      const structured = buildStructuredData(result.data.text, file.name, result.data.confidence);
      extractedRows.push(structured);
      renderTable();
    }

    setStatus('Processamento concluído com sucesso.', 100);
  } catch (error) {
    console.error(error);
    setStatus(`Erro ao processar: ${error.message}`, 0);
  } finally {
    processBtn.disabled = false;
  }
}

function exportToExcel() {
  if (!extractedRows.length) {
    setStatus('Não há dados para exportar.', 0);
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(extractedRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Documentos');

  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  XLSX.writeFile(workbook, `documentos-extraidos-${stamp}.xlsx`);
  setStatus('Arquivo Excel gerado e baixado.', 100);
}

function clearTable() {
  extractedRows.length = 0;
  renderTable();
  progressBar.style.width = '0%';
  setStatus('Tabela limpa. Pronto para novo processamento.');
}

processBtn.addEventListener('click', processFiles);
exportBtn.addEventListener('click', exportToExcel);
clearBtn.addEventListener('click', clearTable);

renderTable();
