package com.sukashawarma.customer.ui.config

import com.sukashawarma.customer.data.api.ConfigDto
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class KonfigurasiAppTest {
    @Test fun `versi di bawah minimum wajib update`() = assertTrue(perluUpdate(1, ConfigDto(versiMinimumAndroid = 2)))
    @Test fun `versi sama atau lebih tinggi tidak`() {
        assertFalse(perluUpdate(2, ConfigDto(versiMinimumAndroid = 2)))
        assertFalse(perluUpdate(3, ConfigDto(versiMinimumAndroid = 2)))
    }
    @Test fun `config gagal dimuat tidak mengunci pelanggan`() = assertFalse(perluUpdate(1, null))
}
