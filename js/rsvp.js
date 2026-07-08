document.addEventListener('DOMContentLoaded', function () {
  // Reemplaza esto con la URL de tu implementación de Apps Script (termina en /exec)
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxHp6nbPBbNxRM7UhZsXIzRgnP3b_9y_4ByXV2gVbqZGw1h_5KBmXFMtsGOSU0PLdk/exec";

  // Token reservado para el link general (invitados individuales sin grupo asignado)
  const TOKEN_GENERAL = "general";

  const envelopeWrap = document.getElementById('envelopeWrap');
  const sealBtn = document.getElementById('sealBtn');
  const openHint = document.getElementById('openHint');
  const rsvpCard = document.getElementById('rsvpCard');
  const deadlineText = document.getElementById('deadlineText');

  let modoActual = null; // "grupo" | "individual"
  let dataActual = null;

  function getToken() {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || TOKEN_GENERAL;
  }

  // --- abrir el sobre ---
  if (sealBtn) {
    sealBtn.addEventListener('click', function () {
      envelopeWrap.classList.add('open');
      openHint.style.display = 'none';
    });
  }

  // --- construye el HTML de una opción de asistencia (pill radio) ---
  function renderAttendOptions(name, groupIndex) {
    const fieldName = `attend-${groupIndex}`;
    return `
      <div class="attend-options" data-field="${fieldName}">
        <label class="option-pill" data-value="yes">
          <input type="radio" name="${fieldName}" value="yes">
          Con gusto asistiré
        </label>
        <label class="option-pill" data-value="no">
          <input type="radio" name="${fieldName}" value="no">
          No podré asistir
        </label>
      </div>
    `;
  }

  // --- pinta el estado "selected" cuando se elige un pill ---
  function activarPills() {
    if (!rsvpCard) return;
    rsvpCard.querySelectorAll('.option-pill').forEach(function (pill) {
      pill.addEventListener('click', function () {
        const group = pill.closest('.attend-options');
        if (!group) return;
        group.querySelectorAll('.option-pill').forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
      });
    });
  }

  // --- renderiza el formulario para un GRUPO (varios invitados fijos) ---
  function renderGrupo(data) {
    if (!rsvpCard) return;
    rsvpCard.innerHTML = `
      <h2>${data.grupo}</h2>
      <p class="panel-text">Confirma la asistencia de tu grupo:</p>
      <div class="guest-list" id="guestList"></div>
      <button class="cta-btn" id="submitBtn" type="button">Confirmar</button>
    `;

    const guestList = document.getElementById('guestList');
    data.invitados.forEach(function (nombre, i) {
      const block = document.createElement('div');
      block.className = 'guest-block';
      block.innerHTML = `<p class="guest-name">${nombre}</p>` + renderAttendOptions(nombre, i);
      guestList.appendChild(block);
    });

    activarPills();
    const submit = document.getElementById('submitBtn');
    if (submit) submit.addEventListener('click', function () {
      enviarGrupo(data.invitados);
    });
  }

  // --- renderiza el formulario para un INVITADO INDIVIDUAL (link general) ---
  function renderIndividual() {
    if (!rsvpCard) return;
    rsvpCard.innerHTML = `
      <h2>Confirma tu asistencia</h2>
      <label class="field-label" for="guestNameInput">Tu nombre completo</label>
      <input type="text" id="guestNameInput" class="name-input" placeholder="Escribe tu nombre completo...">
      <div id="individualOptions">${renderAttendOptions('individual', 0)}</div>
      <button class="cta-btn" id="submitBtn" type="button">Confirmar</button>
    `;

    activarPills();
    const submit = document.getElementById('submitBtn');
    if (submit) submit.addEventListener('click', enviarIndividual);
  }

  function mostrarError(msg) {
    if (!rsvpCard) return;
    rsvpCard.innerHTML = `<p class="panel-text error-text">${msg}</p>`;
  }

  async function cargarInvitacion() {
    const token = getToken();

    // Link general: no necesita datos, es el flujo de input libre
    if (token === TOKEN_GENERAL) {
      modoActual = 'individual';
      dataActual = { tipo: 'individual' };
      renderIndividual();
      if (deadlineText) deadlineText.style.display = 'block';
      return;
    }

    try {
      // Lee de un archivo local (data/grupos.json) en vez de llamar a Apps Script.
      // Esto evita el "cold start" de 3-6s que tiene Apps Script en cada GET.
      const res = await fetch('data/grupos.json');
      const grupos = await res.json();
      const grupo = grupos[token];

      if (!grupo) {
        mostrarError('No pudimos identificar tu invitación. Verifica el enlace o contacta a los novios.');
        return;
      }

      dataActual = { tipo: 'grupo', grupo: grupo.grupo, invitados: grupo.invitados };
      modoActual = 'grupo';
      renderGrupo(dataActual);
      if (deadlineText) deadlineText.style.display = 'block';

    } catch (err) {
      mostrarError('No pudimos cargar tu invitación. Intenta de nuevo más tarde.');
    }
  }

  async function enviarLote(respuestas) {
    // Un solo POST con todas las respuestas, en vez de uno por persona
    return fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ respuestas })
    });
  }

  async function enviarGrupo(invitados) {
    const submitBtn = document.getElementById('submitBtn');

    // valida que cada invitado tenga una opción elegida
    for (let i = 0; i < invitados.length; i++) {
      const seleccionado = rsvpCard.querySelector(`input[name="attend-${i}"]:checked`);
      if (!seleccionado) {
        alert(`Falta indicar si "${invitados[i]}" asistirá.`);
        return;
      }
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando...';
    }

    const respuestas = invitados.map(function (nombre, i) {
      const valor = rsvpCard.querySelector(`input[name="attend-${i}"]:checked`).value;
      return {
        grupo: dataActual.grupo,
        nombre: nombre,
        asistira: valor === 'yes'
      };
    });

    try {
      await enviarLote(respuestas);
      mostrarExito();
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'RSVP ahora';
      }
      alert('Hubo un error enviando tu confirmación. Intenta de nuevo.');
    }
  }

  async function enviarIndividual() {
    const submitBtn = document.getElementById('submitBtn');
    const nombreInput = document.getElementById('guestNameInput');
    const nombre = nombreInput ? nombreInput.value.trim() : '';
    const seleccionado = rsvpCard.querySelector('input[name="attend-0"]:checked');

    if (!nombre) {
      alert('Por favor escribe tu nombre.');
      return;
    }
    if (!seleccionado) {
      alert('Por favor indica si podrás asistir.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando...';
    }

    try {
      await enviarLote([{
        grupo: 'Invitados individuales',
        nombre: nombre,
        asistira: seleccionado.value === 'yes',
      }]);
      mostrarExito();
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'RSVP ahora';
      }
      alert('Hubo un error enviando tu confirmación. Intenta de nuevo.');
    }
  }

  function mostrarExito() {
    if (!rsvpCard) return;
    rsvpCard.innerHTML = `<p class="panel-text success-text">✅ ¡Gracias! Tu confirmación fue recibida.</p>`;
  }

  // Inicia carga
  cargarInvitacion();
});
