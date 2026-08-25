const DS = (() => {
    const ICONS = {
        success: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.4 7.4a1 1 0 01-1.4 0L3.3 9.5a1 1 0 111.4-1.4l3.6 3.6 6.7-6.7a1 1 0 011.4 0z" clip-rule="evenodd"/></svg>',
        error: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-9a1 1 0 012 0v3a1 1 0 01-2 0V9zm1-3a1 1 0 100 2 1 1 0 000-2z" clip-rule="evenodd"/></svg>',
        warning: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.3 3.3a2 2 0 013.4 0l6.5 11.2A2 2 0 0116.5 17.5H3.5a2 2 0 01-1.7-3l6.5-11.2zM10 7a1 1 0 011 1v3a1 1 0 01-2 0V8a1 1 0 011-1zm0 7.5a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/></svg>',
        info: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-6a1 1 0 012 0v3a1 1 0 01-2 0v-3zm1-5a1 1 0 100 2 1 1 0 000-2z" clip-rule="evenodd"/></svg>',
    };

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    let toastContainer = null;
    function getToastContainer() {
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'ds-toast-container';
            document.body.appendChild(toastContainer);
        }
        return toastContainer;
    }

    function toast(message, opts = {}) {
        const { type = 'info', duration = 4000 } = opts;
        const el = document.createElement('div');
        el.className = `ds-toast ds-toast-${type}`;
        el.innerHTML = `
            <span class="ds-toast-icon">${ICONS[type] || ICONS.info}</span>
            <span class="ds-toast-message"></span>
            <button class="ds-toast-close" aria-label="Cerrar">&times;</button>
        `;
        el.querySelector('.ds-toast-message').textContent = message;

        const container = getToastContainer();
        container.appendChild(el);

        let timer = duration > 0 ? setTimeout(() => dismiss(), duration) : null;
        function dismiss() {
            if (timer) clearTimeout(timer);
            el.classList.add('ds-toast-out');
            el.addEventListener('animationend', () => el.remove(), { once: true });
        }
        el.querySelector('.ds-toast-close').addEventListener('click', dismiss);
        return dismiss;
    }

    function openModal({ title, bodyHtml, buttons, onMount }) {
        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'ds-modal-backdrop';
            backdrop.innerHTML = `
                <div class="ds-modal" role="dialog" aria-modal="true">
                    <div class="ds-modal-header">${title}</div>
                    <div class="ds-modal-body">${bodyHtml}</div>
                    <div class="ds-modal-footer"></div>
                </div>
            `;
            const footer = backdrop.querySelector('.ds-modal-footer');
            let settled = false;
            function close(value) {
                if (settled) return;
                settled = true;
                document.removeEventListener('keydown', onKeydown);
                backdrop.remove();
                resolve(value);
            }
            function onKeydown(e) {
                if (e.key === 'Escape') close(buttons.escapeValue);
                if (e.key === 'Enter' && buttons.enterValue !== undefined) close(buttons.enterValue);
            }
            buttons.items.forEach((b) => {
                const btn = document.createElement('button');
                btn.className = `btn ${b.className}`;
                btn.textContent = b.label;
                btn.addEventListener('click', () => close(b.value));
                footer.appendChild(btn);
            });
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) close(buttons.escapeValue);
            });
            document.addEventListener('keydown', onKeydown);
            document.body.appendChild(backdrop);
            if (onMount) onMount(backdrop);

            const focusTarget = backdrop.querySelector('input') || footer.lastElementChild;
            if (focusTarget) focusTarget.focus();
        });
    }

    function confirmAction(message, opts = {}) {
        const { title = 'Confirmar', confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false } = opts;
        return openModal({
            title,
            bodyHtml: `<p style="margin:0">${escapeHtml(message)}</p>`,
            buttons: {
                escapeValue: false,
                enterValue: true,
                items: [
                    { label: cancelText, className: 'btn-secondary', value: false },
                    { label: confirmText, className: danger ? 'btn-danger-outline' : 'btn-primary', value: true },
                ],
            },
        }).then((v) => v);
    }

    function promptAction(message, opts = {}) {
        const { title = 'Ingresa un valor', defaultValue = '', placeholder = '', confirmText = 'Aceptar', cancelText = 'Cancelar' } = opts;
        const inputId = `ds-prompt-${Date.now()}`;
        let liveValue = defaultValue;
        return openModal({
            title,
            bodyHtml: `
                <p style="margin:0 0 12px">${escapeHtml(message)}</p>
                <input class="input" id="${inputId}" type="text" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(defaultValue)}" />
            `,
            onMount: (backdrop) => {
                const input = backdrop.querySelector(`#${inputId}`);
                if (input) input.addEventListener('input', () => { liveValue = input.value; });
            },
            buttons: {
                escapeValue: null,
                enterValue: '__confirm__',
                items: [
                    { label: cancelText, className: 'btn-secondary', value: null },
                    { label: confirmText, className: 'btn-primary', value: '__confirm__' },
                ],
            },
        }).then((v) => (v === '__confirm__' ? liveValue : v));
    }

    function noticeAction(message, opts = {}) {
        const { title = 'Aviso', okText = 'Entendido' } = opts;
        return openModal({
            title,
            bodyHtml: `<p style="margin:0">${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
            buttons: {
                escapeValue: true,
                enterValue: true,
                items: [{ label: okText, className: 'btn-primary', value: true }],
            },
        }).then(() => {});
    }

    return { toast, confirm: confirmAction, prompt: promptAction, notice: noticeAction };
})();
