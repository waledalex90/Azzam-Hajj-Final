/* Purge previously cached API responses from older service workers. */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name === "apis" || name.startsWith("apis-"))
          .map((name) => caches.delete(name)),
      ),
    ),
  );
});
