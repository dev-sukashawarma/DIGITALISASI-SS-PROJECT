// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PermissionModal } from "./PermissionModal";

describe("PermissionModal Component", () => {
  it("does not render when isOpen is false", () => {
    const { container } = render(
      <PermissionModal
        isOpen={false}
        permissionState="prompt"
        onRequestPermissions={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("does not render when permissionState is granted", () => {
    const { container } = render(
      <PermissionModal
        isOpen={true}
        permissionState="granted"
        onRequestPermissions={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders onboarding explanatory modal when permissionState is prompt", () => {
    render(
      <PermissionModal
        isOpen={true}
        permissionState="prompt"
        onRequestPermissions={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Izinkan Kamera & Lokasi" })).toBeInTheDocument();
    expect(screen.getByText(/Kamera Depan/i)).toBeInTheDocument();
    expect(screen.getByText(/Lokasi GPS Akurat/i)).toBeInTheDocument();
  });

  it("triggers onRequestPermissions when Izinkan button is clicked", () => {
    const handleRequest = vi.fn();
    render(
      <PermissionModal
        isOpen={true}
        permissionState="prompt"
        onRequestPermissions={handleRequest}
      />
    );

    const button = screen.getByRole("button", { name: /Izinkan Kamera & Lokasi/i });
    fireEvent.click(button);
    expect(handleRequest).toHaveBeenCalledTimes(1);
  });

  it("renders denied state with step-by-step instructions when permissionState is denied", () => {
    render(
      <PermissionModal
        isOpen={true}
        permissionState="denied"
        onRequestPermissions={vi.fn()}
        errorMessage="Izin kamera atau lokasi ditolak."
      />
    );

    expect(screen.getByText("Izin Ditolak Browser")).toBeInTheDocument();
    expect(screen.getByText(/Izin kamera atau lokasi ditolak/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Coba Lagi \/ Perbarui Izin/i })).toBeInTheDocument();
  });

  it("switches instruction tabs for Chrome and Safari in denied state", () => {
    render(
      <PermissionModal
        isOpen={true}
        permissionState="denied"
        onRequestPermissions={vi.fn()}
      />
    );

    const safariTab = screen.getByRole("button", { name: /Safari \/ iPhone \(iOS\)/i });
    fireEvent.click(safariTab);

    expect(screen.getByText((content) => content.includes("Pengaturan (Settings)"))).toBeInTheDocument();
  });
});
