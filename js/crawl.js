document.addEventListener('DOMContentLoaded', function () {
  const crawlScene = document.getElementById('crawl-scene');
  const skipBtn = document.getElementById('skipBtn');
  const content = document.getElementById('content');

  function goToContent() {
    crawlScene.style.display = 'none';
    document.body.style.overflow = 'auto';
    content.scrollIntoView({ behavior: 'instant' });
  }

  skipBtn.addEventListener('click', goToContent);

  // Cuando termina la animación del crawl, pasa automáticamente al contenido
  const crawlText = document.querySelector('.crawl-text');
  crawlText.addEventListener('animationend', goToContent);

  // Bloquea el scroll de la página mientras se ve la intro
  document.body.style.overflow = 'hidden';
});
