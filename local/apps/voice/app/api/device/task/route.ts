import { NextResponse } from 'next/server';
import { executePhoneAction, type PhoneActionArguments } from '../../../../lib/phone-tool';

export const runtime = 'nodejs';

type PhoneTask = {
  name?: string;
  arguments?: PhoneActionArguments;
};

export async function POST(request: Request): Promise<Response> {
  const task = await request.json() as PhoneTask;
  if (task.name !== 'operate_phone' || !task.arguments?.action) {
    return NextResponse.json({ error: 'Unsupported phone tool request.' }, { status: 400 });
  }

  return NextResponse.json(await executePhoneAction(task.arguments));
}
