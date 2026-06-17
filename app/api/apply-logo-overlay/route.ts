import { NextResponse } from "next/server";

export const maxDuration = 60;

type Body = {
  imageBase64?: string;
  logoUrl?: string;
  position?: string;
  size?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;

    if (!body.imageBase64) {
      return NextResponse.json({ error: "Falta imageBase64." }, { status: 400 });
    }

    // Nota: esta ruta queda preparada para aplicar overlay server-side con Sharp.
    // En esta versión devolvemos la imagen base y el cliente muestra overlay visual.
    // Para quemar el logo dentro del PNG, instalar sharp y procesar aquí.
    return NextResponse.json({
      imageBase64: body.imageBase64,
      logoOverlayApplied: false,
      message: "Overlay preview activo. Para quemar el logo en el PNG, activar Sharp en esta ruta."
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo aplicar el logo." },
      { status: 500 }
    );
  }
}
