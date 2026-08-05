<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\FaunaController;
use App\Http\Controllers\SightingController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ArticleController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\StoreController;

// Public Endpoints
Route::get('/fauna', [FaunaController::class, 'index']);
Route::get('/fauna/{id}', [FaunaController::class, 'show']);
Route::get('/settings', [SettingController::class, 'index']);
Route::get('/policies', [SettingController::class, 'getPolicies']);
Route::get('/articles', [ArticleController::class, 'index']);
Route::get('/articles/{id}', [ArticleController::class, 'show']);
Route::get('/articles/{id}/comments', [CommentController::class, 'getArticleComments']);
Route::post('/articles/{id}/comments', [CommentController::class, 'storeComment']);
Route::post('/sightings', [SightingController::class, 'store']); // kept for compatibility

// Multi-Tenant public store endpoints
Route::get('/stores/featured', [StoreController::class, 'featuredStores']);
Route::get('/check-slug/{slug}', [StoreController::class, 'checkSlug']);
Route::get('/u/{slug}', [StoreController::class, 'show']);
Route::get('/u/{slug}/fauna', [StoreController::class, 'indexFauna']);

// Authentication Endpoints
Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);
Route::post('/auth/google', [AuthController::class, 'googleAuth']);

// Guarded Admin Endpoints (Require Sanctum token + Store ownership check)
Route::middleware(['auth:sanctum', 'store.owner'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/profile', [AuthController::class, 'updateProfile']);
    
    // CRUD postings
    Route::post('/upload-image', [FaunaController::class, 'uploadImage']);
    Route::post('/fauna', [FaunaController::class, 'store']);
    Route::put('/fauna/{id}', [FaunaController::class, 'update']);
    Route::delete('/fauna/{id}', [FaunaController::class, 'destroy']);
    
    // Multi-tenant store profile details & master data options
    Route::post('/stores/update', [StoreController::class, 'update']);
    Route::post('/stores/upgrade-plan', [StoreController::class, 'upgradePlan']);
    Route::post('/stores/add-master-option', [StoreController::class, 'addMasterOption']);
    Route::post('/stores/delete-master-option', [StoreController::class, 'deleteMasterOption']);
    
    // Legacy global settings write (kept for safety)
    Route::post('/settings', [SettingController::class, 'store']);
    Route::post('/settings/policies', [SettingController::class, 'updatePolicy']);
    Route::get('/settings/policy-audit-logs', [SettingController::class, 'getPolicyAuditLogs']);

    // Article CRUD
    Route::post('/articles', [ArticleController::class, 'store']);
    Route::put('/articles/{id}', [ArticleController::class, 'update']);
    Route::delete('/articles/{id}', [ArticleController::class, 'destroy']);

    // Comment admin moderation
    Route::get('/admin/comments', [CommentController::class, 'getAdminComments']);
    Route::post('/admin/comments/{id}/approve', [CommentController::class, 'approveComment']);
    Route::delete('/admin/comments/{id}', [CommentController::class, 'deleteComment']);
});
