<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CertificationResource;
use App\Models\Certification;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CertificationController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return CertificationResource::collection(
            Certification::query()->orderByDesc('year')->orderByDesc('id')->get(),
        );
    }
}
