(() => {
    window.addEventListener('load', () => {
        const content = document.querySelector('.h5p-content');
        let lastWidth = 0;
        let pending = false;
        function fitPlayer(force = false) {
            const width = content.clientWidth;
            if (!force && width === lastWidth) return;
            lastWidth = width;
            if (pending) return;
            pending = true;
            requestAnimationFrame(() => {
                pending = false;
                // This standalone export has no external H5P embed resizer.
                (window.H5P?.instances || []).forEach(instance => instance.trigger('resize'));
                const wrapper = content.querySelector('.h5p-wrapper');
                const footer = content.querySelector('.h5p-footer');
                if (!wrapper || !footer) return;
                const extra = Math.max(0, footer.getBoundingClientRect().bottom - wrapper.getBoundingClientRect().bottom);
                content.style.paddingBottom = `${Math.ceil(extra)}px`;
            });
        }
        new ResizeObserver(() => fitPlayer()).observe(content);
        document.addEventListener('fullscreenchange', () => fitPlayer(true));
        fitPlayer(true);
    });
})();
