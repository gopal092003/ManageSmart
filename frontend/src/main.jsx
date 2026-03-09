import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles/custom.css";

import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 300000, // 5 minutes
      cacheTime: 600000, // 10 minutes
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      retry: 2,
      onError: (error) => {
        console.error("Query Error:", error);
      },
    },
    mutations: {
      retry: 1,
      onError: (error) => {
        console.error("Mutation Error:", error);
      },
    },
  },
});

const rootElement = document.getElementById("root");
console.log("Root element found:", !!rootElement);

if (!rootElement) {
  console.error("Root element not found! Check your index.html");
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
