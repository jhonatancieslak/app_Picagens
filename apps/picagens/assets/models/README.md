<!-- Desenvolvimento: Cieslak Sistemas, jhonatan.cieslak94@gmail.com, +351 935 834 214 -->
# Modelo do rosto

`mobile_facenet.tflite` — MobileFaceNet (ArcFace, MS-Celeb-1M), exportado pela Qualcomm AI Hub v0.65.0
(`mobile_facenet-tflite-float.zip`, https://huggingface.co/qualcomm/MobileFaceNet). Licença **Apache-2.0**
(modelo e implementação original https://github.com/foamliu/MobileFaceNet). Uso comercial permitido; manter este aviso.

- Entradas `img1`, `img2`: float32 `[1, 3, 112, 112]` (NCHW, RGB, valores 0–1).
- Saída `embeddings`: float32 `[2, 128]` (um vetor por entrada); compara-se com semelhança de cosseno.
- SHA-256: `2046ab776fba2ec7e420767ffe7eb74a7402a8412d3d7ea8b9f4ca8420e5f3d7`
