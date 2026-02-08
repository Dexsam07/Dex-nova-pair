// pair.js - Levanter pairing logic (standalone or loaded in pair.html)

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('generateBtn');
  const phoneInput = document.getElementById('phone');
  const codeContainer = document.getElementById('codeContainer');
  const pairCode = document.getElementById('pairCode');
  const status = document.getElementById('status');

  if (!btn) return;

  btn.addEventListener('click', async () => {
    let phone = phoneInput.value.trim().replace(/\D/g, '');

    if (!phone || phone.length < 10) {
      status.innerHTML = '<span class="text-red-400">Enter valid number (with country code)</span>';
      return;
    }

    status.innerHTML = '<span class="text-yellow-400">Please wait...</span>';
    btn.disabled = true;

    try {
      // Baileys pairing code generation
      const sock = makeWASocket({ /* config */ });
      const code = await sock.requestPairingCode(phone);

      pairCode.innerText = code;
      codeContainer.classList.remove('hidden');
      status.innerHTML = '<span class="text-green-400">Success! Paste this code in WhatsApp → Linked Devices</span>';
    } catch (e) {
      status.innerHTML = `<span class="text-red-400">Error: ${e.message}</span>`;
    } finally {
      btn.disabled = false;
    }
  });
});