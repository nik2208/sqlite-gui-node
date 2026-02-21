let tablename;

async function fetchData() {
  try {
    const response = await fetch(`${window.BASE_URL}/api/tables`);
    if (!response.ok) throw new Error("Network response was not ok");
    const data = await response.json();
    populateSidebar(data.data);
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

function populateSidebar(tables) {
  const tablesList = document.getElementById('tables-list');
  if (!tablesList) return;

  const filtered = tables.filter(t => t.name !== 'sqlite_sequence');

  if (filtered.length === 0) {
    tablesList.innerHTML = '<div style="text-align:center;padding:20px 16px;color:#64748b;font-size:12px;">No tables yet.<br>Create one to get started.</div>';
    return;
  }

  tablesList.innerHTML = '';
  filtered.forEach((table) => {
    const btn = document.createElement('button');
    btn.classList.add('sidebar-table-item');
    btn.setAttribute('data-table', table.name);
    btn.innerHTML = `
      <svg class="sidebar-table-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.4"/>
        <line x1="1.5" y1="6" x2="14.5" y2="6" stroke="currentColor" stroke-width="1.4"/>
        <line x1="1.5" y1="10.5" x2="14.5" y2="10.5" stroke="currentColor" stroke-width="1.4"/>
        <line x1="6" y1="6" x2="6" y2="14.5" stroke="currentColor" stroke-width="1.4"/>
      </svg>
      <span class="sidebar-table-name">${table.name}</span>
    `;
    btn.addEventListener('click', function () {
      document.querySelectorAll('.sidebar-table-item').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      tablename = this.getAttribute('data-table');
      const titleEl = document.getElementById('topbar-table-name');
      if (titleEl) titleEl.textContent = tablename;
      fetchTableData(tablename);
    });
    tablesList.appendChild(btn);
  });
}

async function fetchTableData(tableName, paginationParams = { page: 1, perPage: 50 }) {
  try {
    const response = await fetch(`${window.BASE_URL}/api/tables/${tableName}?page=${paginationParams.page}&perPage=${paginationParams.perPage}`);
    if (!response.ok) throw new Error("Network response was not ok");
    const data = await response.json();
    if (data.bool) {
      displayTableData(data.data);
      const pagination = new Pagination({
        element: document.getElementById('pagination_container'),
        perPageOptions: [10, 20, 50, 100],
        defaultPerPage: paginationParams.perPage,
        currentPage: data.meta.page,
        onChange: ({ currentPage, itemsPerPage }) => {
          fetchTableData(tablename, { page: currentPage, perPage: itemsPerPage });
        }
      });
      pagination.setTotalItems(data.meta.total);
    } else {
      console.error("Error fetching table data:", data.error);
    }
  } catch (error) {
    console.error("Error fetching table data:", error);
  }
}

function displayTableData(data) {
  const mainContent = document.getElementById('main-content');
  mainContent.innerHTML = '';

  const tableCard = document.createElement('div');
  tableCard.classList.add('table-card');

  // Card header
  const cardHeader = document.createElement('div');
  cardHeader.classList.add('table-card-header');

  const titleGroup = document.createElement('div');
  titleGroup.style.cssText = 'display:flex;align-items:center;gap:8px;';
  titleGroup.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="color:#64748b;flex-shrink:0;">
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.4"/>
      <line x1="1.5" y1="6" x2="14.5" y2="6" stroke="currentColor" stroke-width="1.4"/>
      <line x1="1.5" y1="10.5" x2="14.5" y2="10.5" stroke="currentColor" stroke-width="1.4"/>
      <line x1="6" y1="6" x2="6" y2="14.5" stroke="currentColor" stroke-width="1.4"/>
    </svg>
  `;
  const cardTitle = document.createElement('h2');
  cardTitle.classList.add('table-card-title');
  cardTitle.textContent = tablename;
  titleGroup.appendChild(cardTitle);
  cardHeader.appendChild(titleGroup);

  const cardActions = document.createElement('div');
  cardActions.classList.add('table-card-actions');

  const insertButton = document.createElement('button');
  insertButton.classList.add('btn-modern', 'btn-primary-modern');
  insertButton.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
    Insert Row
  `;
  insertButton.onclick = () => { window.location.href = `${window.BASE_URL}/insert/${tablename}`; };
  cardActions.appendChild(insertButton);

  const deleteButton = document.createElement('button');
  deleteButton.classList.add('btn-modern', 'btn-danger-modern');
  deleteButton.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 4h10M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M3 4l.8 8h6.4l.8-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    Delete Table
  `;
  deleteButton.onclick = () => {
    if (window.confirm(`Delete table "${tablename}"? This cannot be undone.`)) {
      fetch(`${window.BASE_URL}/api/tables/table/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tablename }),
      })
        .then(response => { if (!response.ok) throw new Error("Network response was not ok"); location.reload(); })
        .catch(error => console.error("Error deleting table:", error));
    }
  };
  cardActions.appendChild(deleteButton);
  cardHeader.appendChild(cardActions);
  tableCard.appendChild(cardHeader);

  if (data.length > 0) {
    const tableWrapper = document.createElement('div');
    tableWrapper.style.overflowX = 'auto';

    const table = document.createElement('table');
    table.classList.add('data-table');

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    let id_name;
    Object.keys(data[0]).forEach((key, idx) => {
      if (idx === 0) id_name = key;
      const th = document.createElement('th');
      th.textContent = key;
      headerRow.appendChild(th);
    });
    const actTh = document.createElement('th');
    actTh.textContent = 'Actions';
    actTh.style.width = '90px';
    headerRow.appendChild(actTh);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    data.forEach((row) => {
      const tr = document.createElement('tr');
      tr.setAttribute('id', 'row-' + row[id_name]);

      Object.values(row).forEach((value, index) => {
        const cell = document.createElement(index === 0 ? 'th' : 'td');
        cell.textContent = value !== null && value !== undefined ? value : '';
        if (index === 0) { cell.setAttribute('scope', 'row'); cell.style.fontWeight = '500'; }
        tr.appendChild(cell);
      });

      const actionsTd = document.createElement('td');
      actionsTd.style.whiteSpace = 'nowrap';

      const editBtn = document.createElement('button');
      editBtn.classList.add('row-action-btn');
      editBtn.title = 'Edit row';
      editBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 2.5l2.5 2.5-7.5 7.5H2.5v-2.5L10 2.5z" stroke="#475569" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      editBtn.onclick = () => { window.location.href = `${window.BASE_URL}/edit/${tablename}/${id_name}/${row[id_name]}`; };
      actionsTd.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.classList.add('row-action-btn', 'delete');
      deleteBtn.title = 'Delete row';
      deleteBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 4.5h9M6 4.5V3h3v1.5M5 7v4M8 7v4M3.5 4.5l.5 7.5h7l.5-7.5" stroke="#ef4444" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      deleteBtn.onclick = () => {
        if (window.confirm("Delete this row?")) {
          fetch(`${window.BASE_URL}/api/tables/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tablename, id: row[id_name] }),
          })
            .then(response => {
              if (!response.ok) throw new Error("Network response was not ok");
              const rowEl = document.getElementById('row-' + row[id_name]);
              if (rowEl) rowEl.remove();
            })
            .catch(error => console.error("Error deleting row:", error));
        }
      };
      actionsTd.appendChild(deleteBtn);
      tr.appendChild(actionsTd);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    tableCard.appendChild(tableWrapper);
  } else {
    const emptyState = document.createElement('div');
    emptyState.classList.add('empty-state');
    emptyState.innerHTML = `
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin:0 auto;">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="#cbd5e1" stroke-width="1.5"/>
        <line x1="3" y1="9" x2="21" y2="9" stroke="#cbd5e1" stroke-width="1.5"/>
        <line x1="3" y1="15" x2="21" y2="15" stroke="#cbd5e1" stroke-width="1.5"/>
        <line x1="9" y1="9" x2="9" y2="21" stroke="#cbd5e1" stroke-width="1.5"/>
      </svg>
      <p>No data in this table</p>
      <span>Click "Insert Row" to add data</span>
    `;
    tableCard.appendChild(emptyState);
  }

  mainContent.appendChild(tableCard);
}

document.addEventListener("DOMContentLoaded", fetchData);
