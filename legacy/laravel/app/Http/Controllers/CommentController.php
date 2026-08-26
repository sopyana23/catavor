<?php

namespace App\Http\Controllers;

use App\Models\Comment;
use App\Models\Article;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CommentController extends Controller
{
    // Public: Get comments for a specific article
    public function getArticleComments($articleId)
    {
        $article = Article::where('id', $articleId)->orWhere('slug', $articleId)->first();
        if (!$article) {
            return response()->json([
                'success' => false,
                'message' => 'Artikel tidak ditemukan.'
            ], 404);
        }

        // Return empty list if comments are disabled
        if (!$article->is_comments_enabled) {
            return response()->json([
                'success' => true,
                'data' => []
            ]);
        }

        // Fetch top-level approved comments with their approved replies
        $comments = $article->comments()
            ->whereNull('parent_id')
            ->where('status', 'approved')
            ->with(['replies' => function ($query) {
                $query->where('status', 'approved')->oldest();
            }])
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'data' => $comments
        ]);
    }

    // Public: Post a comment to a specific article
    public function storeComment(Request $request, $articleId)
    {
        $article = Article::where('id', $articleId)->orWhere('slug', $articleId)->first();
        if (!$article) {
            return response()->json([
                'success' => false,
                'message' => 'Artikel tidak ditemukan.'
            ], 404);
        }

        if (!$article->is_comments_enabled) {
            return response()->json([
                'success' => false,
                'message' => 'Kolom komentar dinonaktifkan untuk artikel ini.'
            ], 400);
        }

        // Dynamically build validation rules
        $rules = [
            'name' => 'required|string|max:100',
            'content' => 'required|string|max:1000',
            'parent_id' => 'nullable|integer|exists:comments,id',
        ];

        if ($article->require_comment_email) {
            $rules['email'] = 'required|email|max:150';
        } else {
            $rules['email'] = 'nullable|email|max:150';
        }

        $validator = Validator::make($request->all(), $rules);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        // DNS MX Verification if enabled
        if ($request->email && $article->verify_comment_email_domain) {
            $email = $request->email;
            $domain = substr(strrchr($email, "@"), 1);
            if (!checkdnsrr($domain, 'MX')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Domain email (@' . $domain . ') tidak valid atau tidak memiliki server surat aktif. Harap masukkan email yang asli.'
                ], 422);
            }
        }

        // If parent_id is provided, verify it belongs to the same article
        if ($request->parent_id) {
            $parentComment = Comment::find($request->parent_id);
            if (!$parentComment || $parentComment->article_id !== $article->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Komentar induk tidak valid.'
                ], 400);
            }
        }

        // Lock name to email if email has commented before
        $commenterName = $request->name;
        if ($request->email) {
            $existingComment = Comment::where('email', $request->email)->latest()->first();
            if ($existingComment) {
                $commenterName = $existingComment->name;
            }
        }

        // Moderation check
        $status = $article->require_comment_approval ? 'pending' : 'approved';

        $comment = Comment::create([
            'article_id' => $article->id,
            'name' => $commenterName,
            'email' => $request->email,
            'content' => $request->content,
            'parent_id' => $request->parent_id,
            'status' => $status
        ]);

        $message = $status === 'pending'
            ? 'Komentar berhasil dikirim dan sedang menunggu persetujuan moderator.'
            : 'Komentar berhasil diposting.';

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $comment
        ]);
    }

    // Admin: List comments for articles belonging to the authenticated user
    public function getAdminComments(Request $request)
    {
        $user = $request->user();
        $comments = Comment::whereHas('article', function($q) use ($user) {
            $q->where('user_id', $user->id);
        })->with([
            'article:id,title,slug',
            'parent:id,name'
        ])->latest()->get();

        return response()->json([
            'success' => true,
            'data' => $comments
        ]);
    }

    // Admin: Approve a comment
    public function approveComment(Request $request, $id)
    {
        $user = $request->user();
        $comment = Comment::with('article')->find($id);
        if (!$comment) {
            return response()->json([
                'success' => false,
                'message' => 'Komentar tidak ditemukan.'
            ], 404);
        }

        if ($comment->article && $comment->article->user_id && $comment->article->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Komentar ini bukan milik artikel Anda.'
            ], 403);
        }

        $comment->update(['status' => 'approved']);

        return response()->json([
            'success' => true,
            'message' => 'Komentar berhasil disetujui.'
        ]);
    }

    // Admin: Delete a comment
    public function destroyComment(Request $request, $id)
    {
        $user = $request->user();
        $comment = Comment::with('article')->find($id);
        if (!$comment) {
            return response()->json([
                'success' => false,
                'message' => 'Komentar tidak ditemukan.'
            ], 404);
        }

        if ($comment->article && $comment->article->user_id && $comment->article->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Akses ditolak. Komentar ini bukan milik artikel Anda.'
            ], 403);
        }

        $comment->delete();
        return response()->json([
            'success' => true,
            'message' => 'Komentar berhasil dihapus.'
        ]);
    }
}
