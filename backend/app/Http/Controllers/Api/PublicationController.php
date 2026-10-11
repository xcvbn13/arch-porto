<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicationResource;
use App\Models\Publication;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PublicationController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return PublicationResource::collection(
            Publication::query()->orderByDesc('year')->orderByDesc('id')->get(),
        );
    }
}
