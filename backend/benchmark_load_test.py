import concurrent.futures
import statistics
import time

import requests

BASE_URL = "http://localhost:8000"


def test_endpoint(endpoint):
    url = f"{BASE_URL}{endpoint}"
    start = time.time()
    try:
        response = requests.get(url, timeout=5)
        duration = (time.time() - start) * 1000  # ms
        return response.status_code, duration
    except Exception:
        return 500, (time.time() - start) * 1000


def run_load_test(concurrency=50, total_requests=200):
    print(f"\n[BENCHMARK] Iniciando Prueba de Carga en Hubzy API ({BASE_URL})")
    print(
        f"[BENCHMARK] Concurrencia: {concurrency} hilos simultaneos | Peticiones totales: {total_requests}"
    )

    endpoints = ["/health", "/api/v1/folders", "/api/v1/ai/training-dataset/stats"]

    tasks = [endpoints[i % len(endpoints)] for i in range(total_requests)]
    latencies = []
    status_codes = {}

    start_total = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        results = executor.map(test_endpoint, tasks)
        for code, dur in results:
            latencies.append(dur)
            status_codes[code] = status_codes.get(code, 0) + 1

    total_time = time.time() - start_total
    rps = total_requests / total_time

    print("\n[RESULTADOS DEL BENCHMARK]:")
    print(f"   * Tiempo total: {total_time:.2f} s")
    print(f"   * Peticiones por segundo (RPS): {rps:.2f} req/s")
    print(f"   * Latencia Media: {statistics.mean(latencies):.2f} ms")
    print(f"   * Latencia Mediana (p50): {statistics.median(latencies):.2f} ms")
    print(
        f"   * Latencia Percentil 95 (p95): {sorted(latencies)[int(len(latencies) * 0.95)]:.2f} ms"
    )
    print(f"   * Latencia Maxima: {max(latencies):.2f} ms")
    print("   * Codigos de Estado:")
    for code, count in status_codes.items():
        print(f"       HTTP {code}: {count} ({count / total_requests * 100:.1f}%)")

    if status_codes.get(200) == total_requests:
        print("\n[EXITO 100%]: La API soporto la concurrencia con CERO errores.")
    else:
        print("\n[ADVERTENCIA]: Se detectaron fallos en algunas peticiones.")


if __name__ == "__main__":
    run_load_test(concurrency=30, total_requests=150)
