/* script.js - frontend */
const BACKEND_URL = 'http://localhost:3000'; // change if backend deployed elsewhere

// DOM elements
const payerIn = document.getElementById('payer');
const amountIn = document.getElementById('amount');
const participantsIn = document.getElementById('participants');
const addBtn = document.getElementById('addBtn');
const clearBtn = document.getElementById('clearBtn');
const expenseList = document.getElementById('expenseList');

const calcBtn = document.getElementById('calcBtn');
const aiBtn = document.getElementById('aiBtn');
const copyBtn = document.getElementById('copyBtn');
const csvBtn = document.getElementById('csvBtn');

const settlementOutput = document.getElementById('settlementOutput');
const aiSummary = document.getElementById('aiSummary');

let expenses = [];

// helpers
function safeNum(v) { return isNaN(v) ? 0 : Number(v); }

function renderExpenses() {
  expenseList.innerHTML = '';
  expenses.forEach((e, i) => {
    const li = document.createElement('li');

    const left = document.createElement('div');
    left.innerHTML = `<strong>${e.payer}</strong> paid ₹${e.amount.toFixed(2)} ${e.participants?.length ? 'for ' + e.participants.join(', ') : ''}`;

    const right = document.createElement('div');
    right.innerHTML = `<button data-i="${i}" class="small ghost">✖</button>`;

    li.append(left, right);
    expenseList.appendChild(li);
  });

  // attach delete handlers
  document.querySelectorAll('#expenseList button').forEach(b => {
    b.addEventListener('click', () => {
      const i = Number(b.dataset.i);
      expenses.splice(i, 1);
      renderExpenses();
    });
  });
}

// add expense
addBtn.addEventListener('click', () => {
  const payer = payerIn.value.trim();
  const amount = safeNum(parseFloat(amountIn.value));
  const participantsRaw = participantsIn.value.trim();

  if (!payer || amount <= 0) { 
    alert('Enter valid payer and amount'); 
    return; 
  }

  const participants = participantsRaw 
    ? participantsRaw.split(',').map(s => s.trim()).filter(Boolean) 
    : [];

  expenses.push({ payer, amount, participants });
  payerIn.value = '';
  amountIn.value = '';
  participantsIn.value = '';
  renderExpenses();
});

// clear
clearBtn.addEventListener('click', () => { 
  expenses = []; 
  renderExpenses(); 
  settlementOutput.innerHTML = ''; 
  aiSummary.innerText = 'Press "Ask AI for Summary" to get a natural language summary.'; 
});

// calculation + optimized settlement
calcBtn.addEventListener('click', () => {
  if (!expenses.length) { 
    alert('Add some expenses'); 
    return; 
  }
  const settlements = computeOptimizedSettlements(expenses);
  displaySettlements(settlements);
  aiSummary.innerText = 'Press "Ask AI for Summary" to get a natural language summary.';
});

// copy
copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(settlementOutput.innerText)
    .then(() => alert('Copied to clipboard'));
});

// CSV export
csvBtn.addEventListener('click', () => {
  const header = 'payer,amount,participants\n';
  const rows = expenses.map(e => 
    `${e.payer},${e.amount},"${(e.participants || []).join('|')}"`
  ).join('\n');

  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); 
  a.href = url; 
  a.download = 'expenses.csv'; 
  a.click();
});

// AI summary request
aiBtn.addEventListener('click', async () => {
  const textSettlements = settlementOutput.innerText || 'No settlement computed yet.';
  aiSummary.innerText = 'Generating AI summary…';
  try {
    const resp = await fetch(`${BACKEND_URL}/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settlements: textSettlements, expenses })
    });
    if (!resp.ok) throw new Error('bad response');
    const data = await resp.json();
    aiSummary.innerText = data.summary || 'No summary returned.';
  } catch (err) {
    console.error(err);
    aiSummary.innerText = 'AI request failed. Check backend (CORS / URL / API key).';
  }
});

/* computeOptimizedSettlements:
   - Build per-person balance (positive = should receive, negative = should pay)
   - Greedily match largest creditor with largest debtor
*/
function computeOptimizedSettlements(expenses) {
  // Determine unique set of people:
  const peopleSet = new Set();
  expenses.forEach(e => {
    peopleSet.add(e.payer);
    (e.participants || []).forEach(p => peopleSet.add(p));
  });
  const people = Array.from(peopleSet);

  // Initialize balances
  const balances = {};
  people.forEach(p => balances[p] = 0);

  // Calculate balances
  expenses.forEach(e => {
    const participants = (e.participants && e.participants.length) ? e.participants : people;
    const split = e.amount / participants.length;
    participants.forEach(p => balances[p] -= split);
    balances[e.payer] += e.amount;
  });

  // Build debtors and creditors
  const debtors = [], creditors = [];
  for (const p of Object.keys(balances)) {
    const val = Number((balances[p]).toFixed(2));
    if (val > 0) creditors.push({ person: p, amount: val });
    else if (val < 0) debtors.push({ person: p, amount: -val });
  }

  // Sort descending amounts
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const settlements = [];
  while (debtors.length && creditors.length) {
    const d = debtors[0];
    const c = creditors[0];
    const amt = Math.min(d.amount, c.amount);
    settlements.push({ from: d.person, to: c.person, amount: Number(amt.toFixed(2)) });
    d.amount = Number((d.amount - amt).toFixed(2));
    c.amount = Number((c.amount - amt).toFixed(2));
    if (d.amount <= 0.009) debtors.shift();
    if (c.amount <= 0.009) creditors.shift();
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);
  }

  return settlements;
}

function displaySettlements(settlements) {
  if (!settlements.length) { 
    settlementOutput.innerText = 'All settled.'; 
    return; 
  }
  settlementOutput.innerHTML = settlements
    .map(s => `${s.from} ➜ ₹${s.amount.toFixed(2)} ➜ ${s.to}`)
    .join('<br>');
}
