<?php

namespace App\Http\Controllers;

use App\Models\Article;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ArticleController extends Controller
{
    public function index()
    {
        $articles = Article::latest()->get();

        return response()->json([
            'success' => true,
            'data' => $articles
        ]);
    }

    public function show($id)
    {
        $article = Article::where('id', $id)->orWhere('slug', $id)->first();

        if (!$article) {
            return response()->json([
                'success' => false,
                'message' => 'Artikel tidak ditemukan.'
            ], 404);
        }

        // Fetch comments and count
        $comments = [];
        $commentsCount = 0;
        if ($article->is_comments_enabled) {
            $comments = $article->comments()
                ->whereNull('parent_id')
                ->where('status', 'approved')
                ->with(['replies' => function($query) {
                    $query->where('status', 'approved')->oldest();
                }])
                ->latest()
                ->get();
            $commentsCount = $article->comments()->where('status', 'approved')->count();
        }
        
        $articleData = $article->toArray();
        $articleData['comments'] = $comments;
        $articleData['comments_count'] = $commentsCount;

        return response()->json([
            'success' => true,
            'data' => $articleData
        ]);
    }

    private function generateUniqueSlug($title, $excludeId = null)
    {
        $slug = \Illuminate\Support\Str::slug($title);
        $originalSlug = $slug;
        $count = 1;

        while (true) {
            $query = Article::where('slug', $slug);
            if ($excludeId) {
                $query->where('id', '!=', $excludeId);
            }

            if (!$query->exists()) {
                break;
            }

            $slug = $originalSlug . '-' . $count;
            $count++;
        }

        return $slug;
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'image_url' => 'nullable|string|max:1000',
            'author' => 'nullable|string|max:100',
            'read_time' => 'nullable|string|max:50',
            'slug' => 'nullable|string|max:255',
            'meta_description' => 'nullable|string|max:255',
            'is_comments_enabled' => 'nullable',
            'require_comment_approval' => 'nullable',
            'require_comment_email' => 'nullable',
            'verify_comment_email_domain' => 'nullable',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $slugInput = $request->slug ? \Illuminate\Support\Str::slug($request->slug) : null;
        if (empty($slugInput)) {
            $slug = $this->generateUniqueSlug($request->title);
        } else {
            $slug = $this->generateUniqueSlug($slugInput);
        }

        // Auto-generate meta description if empty
        $metaDescription = $request->meta_description;
        if (empty($metaDescription)) {
            // Strip tags and grab first 160 characters
            $plainText = strip_tags($request->content);
            $metaDescription = mb_substr($plainText, 0, 155) . (mb_strlen($plainText) > 155 ? '...' : '');
        }

        $article = Article::create([
            'user_id' => $request->user()?->id,
            'title' => $request->title,
            'content' => $request->content,
            'image_url' => $request->image_url,
            'author' => $request->author ?? 'Admin DFauna',
            'read_time' => $request->read_time ?? '5 mnt baca',
            'slug' => $slug,
            'meta_description' => $metaDescription,
            'is_comments_enabled' => $request->has('is_comments_enabled') ? filter_var($request->is_comments_enabled, FILTER_VALIDATE_BOOLEAN) : true,
            'require_comment_approval' => $request->has('require_comment_approval') ? filter_var($request->require_comment_approval, FILTER_VALIDATE_BOOLEAN) : false,
            'require_comment_email' => $request->has('require_comment_email') ? filter_var($request->require_comment_email, FILTER_VALIDATE_BOOLEAN) : false,
            'verify_comment_email_domain' => $request->has('verify_comment_email_domain') ? filter_var($request->verify_comment_email_domain, FILTER_VALIDATE_BOOLEAN) : false,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Artikel berhasil dibuat.',
            'data' => $article
        ]);
    }

    public function update(Request $request, $id)
    {
        $article = Article::find($id);

        if (!$article) {
            return response()->json([
                'success' => false,
                'message' => 'Artikel tidak ditemukan.'
            ], 404);
        }

        $user = $request->user();
        if ($article->user_id && $article->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda tidak memiliki izin untuk mengedit artikel ini.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'image_url' => 'nullable|string|max:1000',
            'author' => 'nullable|string|max:100',
            'read_time' => 'nullable|string|max:50',
            'slug' => 'nullable|string|max:255',
            'meta_description' => 'nullable|string|max:255',
            'is_comments_enabled' => 'nullable',
            'require_comment_approval' => 'nullable',
            'require_comment_email' => 'nullable',
            'verify_comment_email_domain' => 'nullable',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $slugInput = $request->slug ? \Illuminate\Support\Str::slug($request->slug) : null;
        if (empty($slugInput)) {
            $slug = $this->generateUniqueSlug($request->title, $article->id);
        } else {
            $slug = $this->generateUniqueSlug($slugInput, $article->id);
        }

        // Auto-generate meta description if empty
        $metaDescription = $request->meta_description;
        if (empty($metaDescription)) {
            $plainText = strip_tags($request->content);
            $metaDescription = mb_substr($plainText, 0, 155) . (mb_strlen($plainText) > 155 ? '...' : '');
        }

        $article->update([
            'title' => $request->title,
            'content' => $request->content,
            'image_url' => $request->image_url,
            'author' => $request->author ?? 'Admin DFauna',
            'read_time' => $request->read_time ?? '5 mnt baca',
            'slug' => $slug,
            'meta_description' => $metaDescription,
            'is_comments_enabled' => $request->has('is_comments_enabled') ? filter_var($request->is_comments_enabled, FILTER_VALIDATE_BOOLEAN) : true,
            'require_comment_approval' => $request->has('require_comment_approval') ? filter_var($request->require_comment_approval, FILTER_VALIDATE_BOOLEAN) : false,
            'require_comment_email' => $request->has('require_comment_email') ? filter_var($request->require_comment_email, FILTER_VALIDATE_BOOLEAN) : false,
            'verify_comment_email_domain' => $request->has('verify_comment_email_domain') ? filter_var($request->verify_comment_email_domain, FILTER_VALIDATE_BOOLEAN) : false,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Artikel berhasil diperbarui.',
            'data' => $article
        ]);
    }

    public function destroy(Request $request, $id)
    {
        $article = Article::find($id);

        if (!$article) {
            return response()->json([
                'success' => false,
                'message' => 'Artikel tidak ditemukan.'
            ], 404);
        }

        $user = $request->user();
        if ($article->user_id && $article->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Anda tidak memiliki izin untuk menghapus artikel ini.'
            ], 403);
        }

        $article->delete();

        return response()->json([
            'success' => true,
            'message' => 'Artikel berhasil dihapus.'
        ]);
    }
}
