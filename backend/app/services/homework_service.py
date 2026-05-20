from typing import Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.db_models import Homework, Question, StudentAnswer, KnowledgePoint
import uuid


def create_homework(db: Session, project_id: str, title: str, class_id: str = "default-class", homework_date=None) -> Homework:
    hw = Homework(
        project_id=project_id,
        title=title,
        class_id=class_id,
        homework_date=homework_date or datetime.now(),
        status="created",
    )
    db.add(hw)
    db.commit()
    db.refresh(hw)
    return hw


def add_questions(db: Session, homework_id: str, questions: list[dict]) -> list[Question]:
    result = []
    for i, q in enumerate(questions):
        question = Question(
            homework_id=homework_id,
            seq=q.get("seq", i + 1),
            content=q.get("content", f"第{i+1}题"),
            question_type=q.get("question_type", "choice"),
            score=q.get("score", 1.0),
            answer=q.get("answer", ""),
        )
        db.add(question)
        result.append(question)
    db.commit()
    return result


def import_student_answers(db: Session, homework_id: str, answers: list[dict]) -> list[StudentAnswer]:
    questions = db.query(Question).filter(Question.homework_id == homework_id).order_by(Question.seq).all()
    seq_to_qid = {q.seq: str(q.id) for q in questions}

    result = []
    for a in answers:
        qid = a.get("question_id", "")
        if qid == "auto" or not qid:
            seq = a.get("question_seq", len(result) % max(len(questions), 1) + 1)
            qid = seq_to_qid.get(seq, "")

        answer = StudentAnswer(
            homework_id=homework_id,
            student_id=a.get("student_id", ""),
            question_id=qid,
            student_answer=a.get("student_answer", ""),
            score=a.get("score", 0.0),
            is_correct=a.get("is_correct", None),
        )
        if answer.is_correct is None and answer.score is not None:
            question = db.query(Question).filter(Question.id == answer.question_id).first()
            if question:
                answer.is_correct = answer.score >= question.score * 0.6
        db.add(answer)
        result.append(answer)

    hw = db.query(Homework).filter(Homework.id == homework_id).first()
    if hw:
        hw.status = "answers_imported"
    db.commit()
    return result


def get_homework_results(db: Session, homework_id: str) -> dict:
    hw = db.query(Homework).filter(Homework.id == homework_id).first()
    if not hw:
        return {"status": "error", "message": "作业不存在"}

    questions = db.query(Question).filter(Question.homework_id == homework_id).order_by(Question.seq).all()
    answers = db.query(StudentAnswer).filter(StudentAnswer.homework_id == homework_id).all()

    students = {}
    for a in answers:
        if a.student_id not in students:
            students[a.student_id] = {"answers": {}, "total_score": 0.0, "correct_count": 0}
        students[a.student_id]["answers"][str(a.question_id)] = {
            "answer": a.student_answer,
            "score": a.score,
            "is_correct": a.is_correct,
        }
        if a.score:
            students[a.student_id]["total_score"] += a.score
        if a.is_correct:
            students[a.student_id]["correct_count"] += 1

    return {
        "homework_id": str(hw.id),
        "title": hw.title,
        "status": hw.status,
        "question_count": len(questions),
        "student_count": len(students),
        "questions": [
            {"id": str(q.id), "seq": q.seq, "content": q.content, "type": q.question_type, "score": q.score, "q_matrix": q.q_matrix}
            for q in questions
        ],
        "students": students,
        "student_answers": [
            {
                "id": str(a.id),
                "student_id": a.student_id,
                "question_id": str(a.question_id),
                "student_answer": a.student_answer,
                "score": a.score,
                "is_correct": a.is_correct,
            }
            for a in answers
        ],
    }
