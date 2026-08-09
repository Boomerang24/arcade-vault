import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: Request) {
  const { name, email, msg } = await request.json();

  if (!name?.trim() || !email?.trim() || !msg?.trim()) {
    return NextResponse.json(
      { ok: false, error: "Faltan campos requeridos." },
      { status: 400 }
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: "Arcade Vault <onboarding@resend.dev>",
    to: process.env.CONTACT_TO_EMAIL!,
    replyTo: email,
    subject: `Nuevo mensaje de contacto de ${name}`,
    text: `Nombre: ${name}\nCorreo: ${email}\n\nMensaje:\n${msg}`,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "No se pudo enviar el mensaje." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
