<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\EducationResource;
use App\Models\Education;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class EducationController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return EducationResource::collection(
            Education::query()->orderBy('sort_order')->orderByDesc('id')->get(),
        );
    }
}
