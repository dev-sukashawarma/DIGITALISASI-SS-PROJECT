import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periksaParitas } from './paritas-aplikasi-pelanggan.mjs';

const KT = 'mobile/customer-app/app/src/main/java/com/sukashawarma/customer/ui/home/HomeScreen.kt';
const SWIFT = 'mobile/customer-ios-app/SukaShawarma/UI/Home/HomeView.swift';

test('tak menyentuh aplikasi pelanggan -> lolos', () => {
  assert.equal(periksaParitas(['apps/stok/src/x.ts']).ok, true);
});

test('Android dan iOS berubah bersama -> lolos', () => {
  assert.equal(periksaParitas([KT, SWIFT]).ok, true);
});

test('hanya Android -> gagal, menyebut iOS', () => {
  const h = periksaParitas([KT]);
  assert.equal(h.ok, false);
  assert.match(h.alasan, /customer-ios-app/);
});

test('hanya iOS -> gagal, menyebut Android', () => {
  const h = periksaParitas([SWIFT]);
  assert.equal(h.ok, false);
  assert.match(h.alasan, /customer-app/);
});

test('penanda pengecualian meloloskan, tak peka huruf besar', () => {
  assert.equal(periksaParitas([KT], 'fix: izin notifikasi Android 13 [HANYA-ANDROID]').ok, true);
  assert.equal(periksaParitas([SWIFT], 'fix: Sign in with Apple [hanya-ios]').ok, true);
});

test('penanda platform yang salah tidak meloloskan', () => {
  assert.equal(periksaParitas([KT], '[hanya-ios]').ok, false);
  assert.equal(periksaParitas([SWIFT], '[hanya-android]').ok, false);
});

test('berkas non-kode (ikon, gradle, xcodeproj, uji) tidak dihitung', () => {
  assert.equal(periksaParitas([
    'mobile/customer-app/app/build.gradle.kts',
    'mobile/customer-app/app/src/main/res/mipmap-hdpi/ic_launcher.png',
    'mobile/customer-app/app/src/test/java/com/sukashawarma/customer/XTest.kt',
    'mobile/customer-ios-app/SukaShawarma.xcodeproj/project.pbxproj',
    'mobile/customer-ios-app/project.yml',
  ]).ok, true);
});
