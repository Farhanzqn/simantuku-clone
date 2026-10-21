function renderChart(canvasId, type, labels, datasets) {
  const el = document.getElementById(canvasId);
  if (!el) return null;
  return new Chart(el, {
    type,
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: datasets.length > 1 } },
      scales: type === "doughnut" ? undefined : { y: { beginAtZero: true } },
    },
  });
}

function updateChart(chart, labels, datasets) {
  if (!chart) return;
  chart.data.labels = labels;
  chart.data.datasets = datasets;
  chart.update();
}
