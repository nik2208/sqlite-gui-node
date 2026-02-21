document.addEventListener('DOMContentLoaded', function () {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const toggleBtn = document.getElementById('sidebar-toggle-btn');

  if (!sidebar || !toggleBtn) return;

  // Restore desktop collapsed state
  if (window.innerWidth > 768 && localStorage.getItem('sidebarCollapsed') === 'true') {
    sidebar.classList.add('collapsed');
  }

  toggleBtn.addEventListener('click', function () {
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('mobile-open');
      if (overlay) overlay.classList.toggle('visible');
    } else {
      sidebar.classList.toggle('collapsed');
      localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    }
  });

  if (overlay) {
    overlay.addEventListener('click', function () {
      sidebar.classList.remove('mobile-open');
      overlay.classList.remove('visible');
    });
  }

  window.addEventListener('resize', function () {
    if (window.innerWidth > 768) {
      sidebar.classList.remove('mobile-open');
      if (overlay) overlay.classList.remove('visible');
    }
  });
});
