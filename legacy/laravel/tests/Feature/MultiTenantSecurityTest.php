<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Store;
use App\Models\Fauna;
use Illuminate\Foundation\Testing\RefreshDatabase;

class MultiTenantSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected $userA;
    protected $storeA;
    protected $tokenA;

    protected $userB;
    protected $storeB;
    protected $tokenB;

    protected function setUp(): void
    {
        parent::setUp();

        // Create Merchant A (store_slug: store-a)
        $this->userA = User::create([
            'name' => 'Owner Store A',
            'email' => 'storea@example.com',
            'password' => bcrypt('password123'),
            'is_password_changed' => true,
        ]);

        $this->storeA = Store::create([
            'user_id' => $this->userA->id,
            'slug' => 'store-a',
            'store_title' => 'Toko A',
            'plan' => 'free',
            'whatsapp_number' => '62811111111',
            'payment_proof_url' => 'https://example.com/sensitive_proof_a.jpg',
        ]);

        $this->tokenA = $this->userA->createToken('test-token-a')->plainTextToken;

        // Create Merchant B (store_slug: store-b)
        $this->userB = User::create([
            'name' => 'Owner Store B',
            'email' => 'storeb@example.com',
            'password' => bcrypt('password123'),
            'is_password_changed' => true,
        ]);

        $this->storeB = Store::create([
            'user_id' => $this->userB->id,
            'slug' => 'store-b',
            'store_title' => 'Toko B',
            'plan' => 'free',
            'whatsapp_number' => '62822222222',
            'payment_proof_url' => 'https://example.com/sensitive_proof_b.jpg',
        ]);

        $this->tokenB = $this->userB->createToken('test-token-b')->plainTextToken;
    }

    /** @test */
    public function public_store_endpoint_hides_sensitive_payment_proof_url()
    {
        $response = $this->getJson('/api/u/store-b');

        $response->assertStatus(200)
                 ->assertJson(['success' => true])
                 ->assertJsonPath('data.store_title', 'Toko B')
                 ->assertJsonMissing(['payment_proof_url']);
    }

    /** @test */
    public function token_a_cannot_access_or_modify_store_b_with_header_mismatch()
    {
        // Token A sends request targeting store-b via X-Store-Slug header
        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->tokenA,
            'X-Store-Slug' => 'store-b',
        ])->postJson('/api/stores/update', [
            'store_title' => 'Hacked Store B Title',
        ]);

        // Must be rejected with 403 Forbidden
        $response->assertStatus(403)
                 ->assertJson(['success' => false])
                 ->assertJsonPath('message', function ($message) {
                     return str_contains($message, '403 Forbidden') || str_contains($message, 'tidak berhak');
                 });
    }

    /** @test */
    public function token_a_cannot_update_fauna_belonging_to_store_b()
    {
        // Create product belonging to Store B
        $faunaB = Fauna::create([
            'store_id' => $this->storeB->id,
            'name' => 'Produk Store B Original',
            'scientific_name' => 'Original B',
            'class' => 'General',
            'habitat' => 'General',
            'diet' => 'General',
            'conservation_status' => 'Tersedia',
            'price' => 100000,
            'is_shipping_available' => true,
            'description' => 'Produk asli Toko B',
            'image_url' => 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5',
        ]);

        // Token A attempts to update Store B's product
        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->tokenA,
        ])->putJson('/api/fauna/' . $faunaB->id, [
            'name' => 'Produk Hacked By Token A',
            'scientific_name' => 'Hacked B',
            'class' => 'General',
            'habitat' => 'General',
            'diet' => 'General',
            'conservation_status' => 'Tersedia',
            'price' => 1,
            'is_shipping_available' => true,
            'description' => 'Telah diubah secara ilegal',
            'image_url' => 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5',
        ]);

        // Must be rejected with 403 Forbidden
        $response->assertStatus(403)
                 ->assertJson(['success' => false]);

        // Verify Database remains untouched
        $this->assertDatabaseHas('faunas', [
            'id' => $faunaB->id,
            'name' => 'Produk Store B Original',
            'price' => 100000,
        ]);
    }

    /** @test */
    public function token_a_cannot_delete_fauna_belonging_to_store_b()
    {
        // Create product belonging to Store B
        $faunaB = Fauna::create([
            'store_id' => $this->storeB->id,
            'name' => 'Produk Store B Untuk Dihapus',
            'scientific_name' => 'Delete B',
            'class' => 'General',
            'habitat' => 'General',
            'diet' => 'General',
            'conservation_status' => 'Tersedia',
            'price' => 50000,
            'is_shipping_available' => true,
            'description' => 'Deskripsi',
            'image_url' => 'https://images.unsplash.com/photo-1522069169874-c58ec4b76be5',
        ]);

        // Token A attempts to delete Store B's product
        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->tokenA,
        ])->deleteJson('/api/fauna/' . $faunaB->id);

        // Must be rejected with 403 Forbidden
        $response->assertStatus(403)
                 ->assertJson(['success' => false]);

        // Verify product still exists in DB
        $this->assertDatabaseHas('faunas', [
            'id' => $faunaB->id,
        ]);
    }

    /** @test */
    public function token_a_store_operations_only_affect_store_a()
    {
        // Token A updates store without header
        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->tokenA,
        ])->postJson('/api/stores/update', [
            'store_title' => 'Toko A Updated Safely',
        ]);

        $response->assertStatus(200)
                 ->assertJsonPath('data.store_title', 'Toko A Updated Safely');

        // Store B remains completely untouched
        $this->assertDatabaseHas('stores', [
            'id' => $this->storeB->id,
            'store_title' => 'Toko B',
        ]);
    }
}
