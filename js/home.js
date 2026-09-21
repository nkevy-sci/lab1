(() => {
    const frame = document.getElementById('cloud-providers-slides');
    let observer;
    let queued = false;
    function connectPlayer() {
        observer?.disconnect();
        // The relative iframe URL deliberately keeps the player on this origin.
        let doc;
        try { doc = frame.contentDocument; } catch { return; }
        const content = doc?.querySelector('body > div');
        if (!content) return;
        function resize() {
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => {
                queued = false;
                if (doc.fullscreenElement) return;
                const height = Math.ceil(Math.max(content.getBoundingClientRect().height, content.scrollHeight));
                if (height > 0 && frame.style.height !== `${height}px`) {
                    frame.style.height = `${height}px`;
                    doc.defaultView.scrollTo(0, 0);
                }
            });
        }
        observer = new ResizeObserver(resize);
        observer.observe(content);
        doc.addEventListener('fullscreenchange', resize);
        resize();
    }
    frame.addEventListener('load', connectPlayer);
    connectPlayer();
})();
